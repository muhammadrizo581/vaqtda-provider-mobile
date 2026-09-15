// send-sms-otp — Eskiz.uz orqali SMS yuborish (yagona joy; Eskiz kalitlari faqat shu yerda).
//
// Turlari:
//   registration          — ro'yxatdan o'tish kodi. Kod SERVERDA yaratiladi, hash'i
//                           phone_otps ga yoziladi, provider-register tekshiradi.
//                           Kirish talab qilinmaydi; 60 soniyada bir marta.
//   booking_cancelled     — { booking_id }. Faqat shu bron provayderi yoki biriktirilgan
//                           xodimi; bron bekor qilingan bo'lishi shart.
//   waitlist_slot_opened  — { waitlist_id }. Faqat shu navbat yozuvi provayderi.
//
// Ixtiyoriy matn yoki raqam QABUL QILINMAYDI — qabul qiluvchi va matn bazadan olinadi,
// shu sabab funksiyadan boshqalarga SMS yuborish uchun foydalanib bo'lmaydi.
// Bitta bron/navbat yozuvi uchun SMS bir marta ketadi (sms_log).
//
// O'rnatish:
//   supabase secrets set ESKIZ_EMAIL=... ESKIZ_PASSWORD=... ESKIZ_FROM=4546
//   (jadval: supabase/sms-otp.sql)
//   supabase functions deploy send-sms-otp

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateOtp, hashOtp, normalizePhone, OTP_RESEND_MS, OTP_TTL_MS } from "../_shared/otp.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ESKIZ_API_BASE = "https://notify.eskiz.uz/api";

const UZ_MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

function formatUzDateForSms(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return dateStr || "";
  const [, m, d] = dateStr.slice(0, 10).split("-");
  return `${parseInt(d, 10)}-${UZ_MONTHS[parseInt(m, 10) - 1] || "oy"}`;
}

// Eskiz'da tasdiqlangan shablonlar — matn o'zgartirilsa Eskiz SMS'ni rad etadi
const TEMPLATES = {
  registration: (code: string) =>
    `Vaqtda ilovasi orqali ro'yxatdan o'tish uchun tasdiqlash kodi: ${code}. Kodni hech kimga bermang!`,
  refundCancel: (client: string, provider: string, date: string, time: string) =>
    `Hurmatli ${client}! ${provider} kutilmagan texnik sabablarga kora ${formatUzDateForSms(date)} soat ${time} dagi bronni bekor qilishga majbur boldi. Oldindan tolovingiz 100% hisobingizga qaytarildi. Vaqtda ilovasi orqali boshqa vaqtni tanlashingiz mumkin.`,
  transferStaffCancel: (client: string, staff: string) =>
    `Hurmatli ${client}! Usta ${staff} kutilmagan sabab tufayli bugungi qabulni bajara olmaydi. Qabulingizni boshqa mutaxassisga kochirish yoki bekor qilish uchun Vaqtda ilovasiga kiring.`,
  providerCancel: (client: string, provider: string, date: string, time: string, service: string) =>
    `Hurmatli ${client}! ${provider} tomonidan ${formatUzDateForSms(date)} ${time} dagi ${service} xizmatiga broningiz bekor qilindi. Tafsilotlar: Vaqtda ilovasida.`,
  waitlistSlotOpened: (provider: string, date: string, time: string) =>
    `Xushxabar! ${provider} da ${formatUzDateForSms(date)} soat ${time} ga kutish royxatingiz boyicha bosh joy ochildi. Joyni band qilish uchun darhol Vaqtda ilovasiga kiring!`,
};

// jsonb {uz,ru,en} yoki (ichma-ich) JSON satr — o'zbekcha (bo'lmasa ruscha) matn
function plain(value: unknown, depth = 0): string {
  if (value == null || depth > 6) return "";
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    return plain(o.uz, depth + 1) || plain(o.ru, depth + 1) || plain(o.en, depth + 1);
  }
  const s = String(value).trim();
  if (s.startsWith("{") && s.endsWith("}")) {
    try {
      return plain(JSON.parse(s), depth + 1);
    } catch {
      return "";
    }
  }
  return s;
}

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getEskizToken(force = false): Promise<string | null> {
  if (!force && cachedToken && tokenExpiresAt > Date.now()) return cachedToken;
  const form = new FormData();
  form.append("email", Deno.env.get("ESKIZ_EMAIL") ?? "");
  form.append("password", Deno.env.get("ESKIZ_PASSWORD") ?? "");
  const res = await fetch(`${ESKIZ_API_BASE}/auth/login`, { method: "POST", body: form });
  if (!res.ok) return null;
  const token = (await res.json())?.data?.token;
  if (!token) return null;
  cachedToken = token;
  tokenExpiresAt = Date.now() + 29 * 24 * 60 * 60 * 1000; // Eskiz tokeni 30 kun
  return token;
}

async function sendSms(phone: string, message: string): Promise<boolean> {
  let token = await getEskizToken();
  if (!token) return false;
  const send = (auth: string) => {
    const form = new FormData();
    form.append("mobile_phone", phone);
    form.append("message", message);
    form.append("from", Deno.env.get("ESKIZ_FROM") || "4546");
    return fetch(`${ESKIZ_API_BASE}/message/sms/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${auth}` },
      body: form,
    });
  };
  let res = await send(token);
  if (res.status === 401) {
    token = await getEskizToken(true);
    if (!token) return false;
    res = await send(token);
  }
  if (!res.ok) console.error("[send-sms-otp] Eskiz xatosi:", res.status, await res.text().catch(() => ""));
  return res.ok;
}

// Chaqiruvchi shu provayder egasimi (yoki bronga biriktirilgan xodimmi)?
async function canActOnProvider(
  admin: SupabaseClient,
  userId: string,
  providerId: string,
  staffId: string | null
): Promise<boolean> {
  const { data: own } = await admin
    .from("providers")
    .select("id")
    .eq("id", providerId)
    .eq("user_id", userId)
    .maybeSingle();
  if (own) return true;
  if (!staffId) return false;
  const { data: staff } = await admin
    .from("provider_staff")
    .select("id")
    .eq("id", staffId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!staff;
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
    if (!Deno.env.get("ESKIZ_EMAIL") || !Deno.env.get("ESKIZ_PASSWORD")) {
      return json({ error: "not_configured" }, 500);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const type = String(body.type ?? "");

    // ── Ro'yxatdan o'tish kodi ──────────────────────────────────────────────
    if (type === "registration") {
      const phone = normalizePhone(String(body.phone ?? ""));
      if (phone.length !== 12 || !phone.startsWith("998")) return json({ error: "invalid_phone" }, 400);

      const { data: existing } = await admin
        .from("phone_otps")
        .select("created_at")
        .eq("phone", phone)
        .maybeSingle();
      if (existing && Date.now() - new Date(existing.created_at).getTime() < OTP_RESEND_MS) {
        return json({ error: "too_many_requests" }, 429);
      }

      const code = generateOtp();
      const { error: storeErr } = await admin.from("phone_otps").upsert({
        phone,
        code_hash: await hashOtp(phone, code),
        attempts: 0,
        expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
        created_at: new Date().toISOString(),
      });
      if (storeErr) {
        console.error("[send-sms-otp] phone_otps:", storeErr.message);
        return json({ error: "otp_store_failed" }, 500);
      }

      if (!(await sendSms(phone, TEMPLATES.registration(code)))) {
        await admin.from("phone_otps").delete().eq("phone", phone);
        return json({ error: "sms_send_failed" }, 502);
      }
      return json({ ok: true });
    }

    // ── Qolgan turlar — faqat kirgan provayder/xodim, faqat o'z mijoziga ─────
    const caller = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const {
      data: { user },
    } = await caller.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    // Bitta bron/yozuv uchun SMS bir marta ketadi; yuborilmasa jurnal qaytariladi
    const sendOnce = async (kind: string, refId: string, phone: string, message: string) => {
      const { error: logErr } = await admin.from("sms_log").insert({ kind, ref_id: refId, phone });
      if (logErr) {
        if (logErr.code === "23505") return json({ ok: true, duplicate: true });
        console.error("[send-sms-otp] sms_log:", logErr.message);
        return json({ error: "log_failed" }, 500);
      }
      if (!(await sendSms(phone, message))) {
        await admin.from("sms_log").delete().eq("kind", kind).eq("ref_id", refId);
        return json({ error: "sms_send_failed" }, 502);
      }
      return json({ ok: true });
    };

    if (type === "booking_cancelled") {
      const bookingId = String(body.booking_id ?? "");
      const { data: b } = await admin
        .from("bookings")
        .select("id, provider_id, client_id, staff_id, service_id, booking_date, start_time, status")
        .eq("id", bookingId)
        .maybeSingle();
      if (!b) return json({ error: "not_found" }, 404);
      if (!(await canActOnProvider(admin, user.id, b.provider_id, b.staff_id))) {
        return json({ error: "forbidden" }, 403);
      }
      if (b.status !== "cancelled") return json({ error: "not_cancelled" }, 409);

      const [{ data: client }, { data: provider }, { data: service }, { data: staff }, { data: pays }] =
        await Promise.all([
          admin.from("profiles").select("full_name, phone").eq("id", b.client_id).maybeSingle(),
          admin.from("providers").select("business_name, slug").eq("id", b.provider_id).maybeSingle(),
          b.service_id
            ? admin.from("services").select("name").eq("id", b.service_id).maybeSingle()
            : Promise.resolve({ data: null }),
          b.staff_id
            ? admin.from("provider_staff").select("full_name").eq("id", b.staff_id).maybeSingle()
            : Promise.resolve({ data: null }),
          admin.from("payments").select("amount").eq("booking_id", b.id).eq("status", "paid"),
        ]);

      const phone = normalizePhone(String(client?.phone ?? ""));
      if (phone.length !== 12) return json({ error: "no_phone" }, 422);

      const clientName = client?.full_name || "Mijoz";
      const providerName = plain(provider?.business_name) || provider?.slug || "Vaqtda";
      const time = String(b.start_time ?? "").slice(0, 5);
      const paid = (pays ?? []).reduce((s: number, p: { amount: number | null }) => s + Number(p.amount || 0), 0);

      // Shablon tanlash: to'lov qaytarildi → usta bekor qildi → provayder bekor qildi
      const message =
        paid > 0
          ? TEMPLATES.refundCancel(clientName, providerName, b.booking_date, time)
          : staff?.full_name
            ? TEMPLATES.transferStaffCancel(clientName, staff.full_name)
            : TEMPLATES.providerCancel(
                clientName,
                providerName,
                b.booking_date,
                time,
                plain(service?.name) || "Xizmat"
              );
      return await sendOnce("booking_cancelled", b.id, phone, message);
    }

    if (type === "waitlist_slot_opened") {
      const waitlistId = String(body.waitlist_id ?? "");
      const { data: w } = await admin
        .from("waitlist")
        .select("id, provider_id, client_id, desired_date, time_from")
        .eq("id", waitlistId)
        .maybeSingle();
      if (!w) return json({ error: "not_found" }, 404);
      if (!(await canActOnProvider(admin, user.id, w.provider_id, null))) {
        return json({ error: "forbidden" }, 403);
      }

      const [{ data: client }, { data: provider }] = await Promise.all([
        admin.from("profiles").select("phone").eq("id", w.client_id).maybeSingle(),
        admin.from("providers").select("business_name, slug").eq("id", w.provider_id).maybeSingle(),
      ]);
      const phone = normalizePhone(String(client?.phone ?? ""));
      if (phone.length !== 12) return json({ error: "no_phone" }, 422);

      const providerName = plain(provider?.business_name) || provider?.slug || "Vaqtda";
      const time = w.time_from ? String(w.time_from).slice(0, 5) : "10:00";
      return await sendOnce(
        "waitlist_slot_opened",
        w.id,
        phone,
        TEMPLATES.waitlistSlotOpened(providerName, w.desired_date, time)
      );
    }

    return json({ error: "unknown_type" }, 400);
  } catch (err) {
    console.error("[send-sms-otp] Server xatosi:", err);
    return json({ error: "server_error" }, 500);
  }
});
