// delete-account — foydalanuvchi o'z hisobini ilova ichidan o'chiradi
// (App Store Review Guideline 5.1.1(v): akkaunt yaratish mumkin bo'lgan ilovada
// uni o'chirish imkoniyati ham bo'lishi shart).
//
// Bronlar, to'lovlar va chatlar tarixi boshqa jadvallarda auth foydalanuvchiga
// bog'langan, shuning uchun auth akkaunt "soft delete" qilinadi: unga qayta kirib
// bo'lmaydi, email/telefon yashiriladi. Qo'shimcha ravishda:
//   • shaxsiy ma'lumotlar (ism, telefon, rasm, username, push token) tozalanadi;
//   • biznes egasi bo'lsa — biznes mijozlardan yashiriladi, xodimlar loginlari o'chiriladi;
//   • xodim bo'lsa — klinika/do'kondagi yozuvidan akkaunt uziladi.
//
// Deploy: supabase functions deploy delete-account

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

    // 1) Chaqiruvchini aniqlaymiz — faqat O'Z akkauntini o'chira oladi
    const caller = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const {
      data: { user },
    } = await caller.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);
    const uid = user.id;

    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 2) Biznes egasi — biznes yashiriladi, xodimlarning login/parollari o'chiriladi
    const { data: owned } = await admin.from("providers").select("id").eq("user_id", uid);
    for (const p of owned ?? []) {
      const { error } = await admin.from("providers").update({ is_active: false }).eq("id", p.id);
      if (error) console.error("[delete-account] providers:", error.message);
      await admin.from("worker_credentials").delete().eq("provider_id", p.id);
    }

    // 3) Xodim — ish joyidagi yozuvidan akkaunt uziladi (klinika tarixi saqlanadi)
    const { data: staffRows } = await admin.from("provider_staff").select("id").eq("user_id", uid);
    for (const s of staffRows ?? []) {
      await admin.from("worker_credentials").delete().eq("worker_id", s.id);
      const { error } = await admin.from("provider_staff").update({ user_id: null }).eq("id", s.id);
      if (error) console.error("[delete-account] provider_staff:", error.message);
    }

    // 4) Shaxsiy ma'lumotlarni tozalash. Ba'zi ustunlar NOT NULL bo'lishi mumkin —
    //    unda kamroq maydon bilan qayta urinamiz
    const { error: profErr } = await admin
      .from("profiles")
      .update({ full_name: null, phone: null, avatar_url: null, username: null, push_token: null })
      .eq("id", uid);
    if (profErr) {
      console.error("[delete-account] profiles:", profErr.message);
      await admin.from("profiles").update({ phone: null, avatar_url: null, push_token: null }).eq("id", uid);
    }

    // 5) Auth akkaunt — soft delete (qayta kirib bo'lmaydi, bog'liq tarix buzilmaydi)
    const { error: delErr } = await admin.auth.admin.deleteUser(uid, true);
    if (delErr) {
      console.error("[delete-account] deleteUser:", delErr.message);
      return json({ error: "delete_failed" }, 500);
    }

    return json({ ok: true });
  } catch (err) {
    console.error("[delete-account] Server xatosi:", err);
    return json({ error: "server_error" }, 500);
  }
});
