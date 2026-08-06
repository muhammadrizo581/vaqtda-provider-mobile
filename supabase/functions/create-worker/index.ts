// create-worker — owner o'z biznesiga usta (staff) akkaunti yaratadi.
//
// Baza allaqachon `provider_staff` jadvaliga ega (user_id — login akkaunti).
// Usta uchun ALOHIDA rol yo'q (user_role enum = client|provider|admin), shuning
// uchun role QO'YILMAYDI — usta = provider_staff.user_id bo'lgan foydalanuvchi.
//
// Nega Edge Function: yangi auth akkaunt yaratish uchun service_role kaliti kerak,
// u mobil ilovada bo'lishi mumkin emas (huddi provider-register kabi).
//
// Oqim: owner login+parol kiritadi -> bu funksiya akkaunt yaratadi + profiles
// (username) + provider_staff yozuvi. Usta shu login bilan kirib profilini o'zi
// to'ldiradi (ism/rasm/mutaxassislik/bio/telefon).
//
// Deploy: supabase functions deploy create-worker

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Usta login uchun sintetik email domeni (real emas — usta username bilan kiradi)
const WORKER_EMAIL_DOMAIN = "workers.vaqtda.uz";

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

    // 2) Admin klient (service_role) — akkaunt yaratish uchun
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
    const username = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const fullName = String(body.full_name ?? body.label ?? "").trim();

    if (!/^[a-z0-9_.-]{3,30}$/.test(username)) return json({ error: "invalid_username" }, 400);
    if (password.length < 6) return json({ error: "password_short" }, 400);
    if (!fullName) return json({ error: "name_required" }, 400);

    // 5) Username bandligini tekshiramiz
    const { data: taken } = await admin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (taken) return json({ error: "username_taken" }, 409);

    // 6) Auth akkauntini yaratamiz (sintetik email, tasdiqsiz). ROL QO'YILMAYDI.
    const email = `${username}@${WORKER_EMAIL_DOMAIN}`;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, provider_id: provider.id, is_staff: true },
    });
    if (createErr || !created?.user) {
      const msg = `${createErr?.message ?? ""}`.toLowerCase();
      if (msg.includes("already") || msg.includes("registered")) {
        return json({ error: "username_taken" }, 409);
      }
      if (msg.includes("password")) return json({ error: "password_short" }, 400);
      return json({ error: "create_failed" }, 500);
    }
    const staffUserId = created.user.id;

    // 7) profiles — username + ism (ROL O'ZGARTIRILMAYDI; signup trigger default
    //    qo'yadi, biz faqat username/ism yozamiz)
    const { error: profErr } = await admin.from("profiles").upsert(
      { id: staffUserId, username, full_name: fullName },
      { onConflict: "id" }
    );
    if (profErr) {
      await admin.auth.admin.deleteUser(staffUserId);
      return json({ error: "profile_failed" }, 500);
    }

    // 8) profile_usernames — username->email hal qilinishi shu jadvalga bog'liq
    //    bo'lishi mumkin (mavjud bo'lmasa — e'tiborsiz)
    try {
      await admin
        .from("profile_usernames")
        .upsert({ user_id: staffUserId, username }, { onConflict: "user_id" });
    } catch (_) {
      /* profile_usernames jadvali yo'q bo'lsa — profiles.username yetarli */
    }

    // 9) provider_staff yozuvi — owner biznesiga bog'laymiz (full_name majburiy)
    const { data: staff, error: sErr } = await admin
      .from("provider_staff")
      .insert({ provider_id: provider.id, user_id: staffUserId, full_name: fullName, is_active: true })
      .select("id")
      .single();
    if (sErr || !staff) {
      // Rollback: yaratilgan akkauntni o'chiramiz — yetim akkaunt qolmasin
      await admin.auth.admin.deleteUser(staffUserId);
      return json({ error: "staff_insert_failed" }, 500);
    }

    // 10) worker_credentials — login/parolni OCHIQ saqlaymiz (RLS: faqat ega o'qiydi).
    //     Shifokorlar bilan bir xil jadval → Ustalar ekranida ham login+parol
    //     doim ko'rsatiladi. Yangi usta — doim INSERT. Xatoni javobda qaytaramiz.
    const { error: credErr } = await admin
      .from("worker_credentials")
      .insert({ worker_id: staff.id, provider_id: provider.id, username, password, email });
    if (credErr) console.error("worker_credentials insert failed:", credErr.message);

    return json({ ok: true, staff_id: staff.id, username, cred_error: credErr?.message ?? null });
  } catch (_e) {
    return json({ error: "server_error" }, 500);
  }
});
