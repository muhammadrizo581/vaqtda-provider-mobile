// provider-register — Yangi provayder (biznes egasi) akkauntini yaratish uchun Supabase Edge Function.
//
// Oqim:
//   0. SMS kodni tekshiradi (send-sms-otp yaratgan, phone_otps jadvalida)
//   1. Yangi auth foydalanuvchi yaratadi (email, password, email_confirm: true)
//   2. profiles jadvalida yozuv yaratadi/yangilaydi (full_name, phone, role='provider')
//   3. providers jadvalida biznes yaratadi (business_name, phone_number, slug, status='approved', is_active=true)
//
// Deploy: supabase functions deploy provider-register

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hashOtp, normalizePhone, OTP_MAX_ATTEMPTS } from "../_shared/otp.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "") || "provider";
}

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
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const fullName = String(body.full_name ?? "").trim();
    const phone = normalizePhone(String(body.phone ?? ""));
    const businessName = String(body.business_name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const otp = String(body.otp ?? "").trim();

    if (!fullName) return json({ error: "name_required" }, 400);
    if (!businessName) return json({ error: "business_name_required" }, 400);
    if (phone.length !== 12 || !phone.startsWith("998")) return json({ error: "invalid_phone" }, 400);
    if (!email || !email.includes("@")) return json({ error: "email_invalid" }, 400);
    if (password.length < 6) return json({ error: "password_short" }, 400);

    // 0) SMS kodni tekshirish — kod ilovada emas, faqat serverda solishtiriladi
    const { data: otpRow } = await admin
      .from("phone_otps")
      .select("code_hash, attempts, expires_at")
      .eq("phone", phone)
      .maybeSingle();
    if (
      !otpRow ||
      new Date(otpRow.expires_at).getTime() < Date.now() ||
      otpRow.attempts >= OTP_MAX_ATTEMPTS
    ) {
      return json({ error: "otp_expired" }, 400);
    }
    if (!otp || otpRow.code_hash !== (await hashOtp(phone, otp))) {
      await admin.from("phone_otps").update({ attempts: otpRow.attempts + 1 }).eq("phone", phone);
      return json({ error: "otp_invalid" }, 400);
    }

    // 1) Email bandligini tekshirish
    const { data: existingUser } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingUser) {
      return json({ error: "email_taken" }, 409);
    }

    // 2) Supabase Auth orqali user yaratish
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone: `+${phone}`,
        role: "provider",
      },
    });

    if (authError || !authData?.user) {
      const msg = (authError?.message || "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered")) {
        return json({ error: "email_taken" }, 409);
      }
      if (msg.includes("password")) {
        return json({ error: "password_short" }, 400);
      }
      console.error("[provider-register] createUser:", authError?.message);
      return json({ error: "create_user_failed" }, 500);
    }

    const userId = authData.user.id;

    // 3) profiles — role='provider' bo'lmasa foydalanuvchi panelga kira olmaydi,
    //    shuning uchun xato bo'lsa akkauntni qaytarib o'chiramiz (yetim akkaunt qolmasin)
    const { error: profErr } = await admin.from("profiles").upsert({
      id: userId,
      full_name: fullName,
      email,
      phone: `+${phone}`,
      role: "provider",
    });
    if (profErr) {
      console.error("[provider-register] profiles:", profErr.message);
      await admin.auth.admin.deleteUser(userId);
      return json({ error: "profile_failed" }, 500);
    }

    // Kod ishlatildi — qayta foydalanib bo'lmasin
    await admin.from("phone_otps").delete().eq("phone", phone);

    // 4) Unique slug yaratish
    const baseSlug = slugify(businessName);
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const { data: existingSlug } = await admin
        .from("providers")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (!existingSlug) break;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // 5) providers jadvaliga yangi biznes yozish
    const { data: providerData, error: provError } = await admin
      .from("providers")
      .insert({
        user_id: userId,
        business_name: businessName,
        slug: slug,
        phone_number: `+${phone}`,
        status: "approved",
        is_active: true,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (provError) {
      // Akkaunt tayyor (role=provider) — biznesni ilovadagi "Biznes yaratish" orqali qo'shsa bo'ladi
      console.error("[provider-register] Provider yaratishda xato:", provError);
    }

    return json({
      success: true,
      user_id: userId,
      provider_id: providerData?.id,
      slug: slug,
    });
  } catch (err) {
    console.error("[provider-register] Server xatosi:", err);
    return json({ error: "server_error" }, 500);
  }
});
