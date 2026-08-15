// reset-worker-password — owner o'z ustasiga YANGI parol o'rnatadi.
//
// Nega Edge Function: parol Supabase auth'da hash bo'lib saqlanadi — yaratilgandan
// keyin uni qayta o'qib bo'lmaydi. Owner ustaning parolini unutgan/almashtirmoqchi
// bo'lsa, yangi parol generatsiya qilib shu funksiya orqali o'rnatadi (service_role
// kaliti kerak, u mobil ilovada bo'lishi mumkin emas).
//
// Oqim: owner staff_id + yangi parol yuboradi -> funksiya ustaning egasi shu owner
// ekanini tekshiradi -> auth akkauntning parolini yangilaydi. Login o'zgarmaydi.
//
// Deploy: supabase functions deploy reset-worker-password

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    // 1) Chaqiruvchini (owner) aniqlaymiz — uning tokeni bilan
    const caller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: owner },
    } = await caller.auth.getUser();
    if (!owner) return json({ error: "unauthorized" }, 401);

    // 2) Admin klient (service_role) — parol o'rnatish uchun
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 3) Owner haqiqatan provider (biznes egasi) ekanini tekshiramiz
    const { data: provider } = await admin
      .from("providers")
      .select("id")
      .eq("user_id", owner.id)
      .maybeSingle();
    if (!provider) return json({ error: "not_owner" }, 403);

    // 4) Kirish ma'lumotlari
    const body = await req.json().catch(() => ({}));
    const staffId = String(body.staff_id ?? "").trim();
    const password = String(body.password ?? "");
    if (!staffId) return json({ error: "staff_required" }, 400);
    if (password.length < 6) return json({ error: "password_short" }, 400);

    // 5) Usta shu ownerga tegishli ekanini tekshiramiz + user_id ni olamiz
    const { data: staff } = await admin
      .from("provider_staff")
      .select("id, user_id, provider_id")
      .eq("id", staffId)
      .maybeSingle();
    if (!staff || staff.provider_id !== provider.id) return json({ error: "not_your_staff" }, 403);
    if (!staff.user_id) return json({ error: "no_account" }, 400);

    // 6) Parolni yangilaymiz
    const { error: updErr } = await admin.auth.admin.updateUserById(staff.user_id, { password });
    if (updErr) {
      const msg = `${updErr.message ?? ""}`.toLowerCase();
      if (msg.includes("password")) return json({ error: "password_short" }, 400);
      return json({ error: "update_failed" }, 500);
    }

    // 7) Login (username) va email — worker_credentials va javob uchun. Email
    //    NOT NULL (jadval talab qiladi) — auth akkauntdan olamiz.
    const { data: prof } = await admin
      .from("profiles")
      .select("username")
      .eq("id", staff.user_id)
      .maybeSingle();
    const username = prof?.username ?? null;
    const { data: authUser } = await admin.auth.admin.getUserById(staff.user_id);
    const email = authUser?.user?.email ?? (username ? `${username}@workers.vaqtda.uz` : null);

    // 8) worker_credentials — yangi parolni OCHIQ saqlaymiz (RLS: faqat ega o'qiydi).
    //     Login o'zgarmaydi; faqat parol yangilanadi. onConflict'ga tayanmaymiz
    //     (worker_id'da unique constraint bo'lmasligi mumkin): avval UPDATE, bo'lmasa
    //     INSERT. Xato bo'lsa — javobda qaytaramiz (cred_error) diagnostika uchun.
    let credError: string | null = null;
    if (username) {
      const { data: upd, error: updErr2 } = await admin
        .from("worker_credentials")
        .update({ username, password })
        .eq("worker_id", staff.id)
        .select("worker_id");
      credError = updErr2?.message ?? null;
      if (!credError && (!upd || upd.length === 0)) {
        const { error: insErr } = await admin
          .from("worker_credentials")
          .insert({ worker_id: staff.id, provider_id: provider.id, username, password, email });
        credError = insErr?.message ?? null;
      }
      if (credError) console.error("worker_credentials write failed:", credError);
    }

    return json({ ok: true, username, password, cred_error: credError });
  } catch (_e) {
    return json({ error: "server_error" }, 500);
  }
});
