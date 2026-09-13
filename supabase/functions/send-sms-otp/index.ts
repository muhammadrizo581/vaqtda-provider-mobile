// send-sms-otp — Eskiz.uz orqali SMS/OTP yuborish uchun Supabase Edge Function.
//
// Barcha rasmiy shablonlar:
// 1. registration: "Vaqtda ilovasi orqali ro'yxatdan o'tish uchun tasdiqlash kodi: {CODE}. Kodni hech kimga bermang!"
// 2. login: "Vaqtda ilovasiga kirish uchun tasdiqlash kodi: {CODE}. Kodni hech kimga bermang!"
// 3. password_reset: "Vaqtda platformasida parolni tiklash uchun tasdiqlash kodi: {CODE}. Kodni hech kimga bermang!"
// 4. phone_update: "Vaqtda ilovasida yangi telefon raqamni tasdiqlash uchun kod: {CODE}. Kodni hech kimga bermang!"
// 5. unexpected_cancel: "Hurmatli {CLIENT_NAME}! {PROVIDER_NAME} mutaxassisi kutilmagan favqulodda sababga kora {DATE} soat {TIME} dagi qabulingizni amalga oshira olmaydi. Noqulaylik uchun uzr soraymiz. Boshqa vaqtga yozilish: vaqtda.uz"
// 6. refund_cancel: "Hurmatli {CLIENT_NAME}! {PROVIDER_NAME} kutilmagan texnik sabablarga kora {DATE} soat {TIME} dagi bronni bekor qilishga majbur boldi. Oldindan tolovingiz 100% hisobingizga qaytarildi. Vaqtda ilovasi orqali boshqa vaqtni tanlashingiz mumkin."
// 7. transfer_staff_cancel: "Hurmatli {CLIENT_NAME}! Usta {STAFF_NAME} kutilmagan sabab tufayli bugungi qabulni bajara olmaydi. Qabulingizni boshqa mutaxassisga kochirish yoki bekor qilish uchun Vaqtda ilovasiga kiring."
// 8. provider_cancel: "Hurmatli {CLIENT_NAME}! {PROVIDER_NAME} tomonidan {DATE} {TIME} dagi {SERVICE_NAME} xizmatiga broningiz bekor qilindi. Tafsilotlar: Vaqtda ilovasida."
// 9. waitlist_slot_opened: "Xushxabar! {PROVIDER_NAME} da {DATE} soat {TIME} ga kutish royxatingiz boyicha bosh joy ochildi. Joyni band qilish uchun darhol Vaqtda ilovasiga kiring!"
//
// Deploy: supabase functions deploy send-sms-otp

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ESKIZ_API_BASE = "https://notify.eskiz.uz/api";

const UZ_MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"
];

function formatUzDateForSms(dateStr: string): string {
  if (!dateStr) return "";
  if (dateStr.includes("-") && dateStr.length === 10) {
    const parts = dateStr.split("-");
    const day = parseInt(parts[2], 10);
    const month = parseInt(parts[1], 10) - 1;
    return `${day}-${UZ_MONTHS[month] || "oy"}`;
  }
  return dateStr;
}

const TEMPLATES: Record<string, (params: any) => string> = {
  registration: (p: any) =>
    `Vaqtda ilovasi orqali ro'yxatdan o'tish uchun tasdiqlash kodi: ${p.code}. Kodni hech kimga bermang!`,
  login: (p: any) =>
    `Vaqtda ilovasiga kirish uchun tasdiqlash kodi: ${p.code}. Kodni hech kimga bermang!`,
  password_reset: (p: any) =>
    `Vaqtda platformasida parolni tiklash uchun tasdiqlash kodi: ${p.code}. Kodni hech kimga bermang!`,
  phone_update: (p: any) =>
    `Vaqtda ilovasida yangi telefon raqamni tasdiqlash uchun kod: ${p.code}. Kodni hech kimga bermang!`,
  unexpected_cancel: (p: any) =>
    `Hurmatli ${p.client_name || "Mijoz"}! ${p.provider_name} mutaxassisi kutilmagan favqulodda sababga kora ${formatUzDateForSms(p.date)} soat ${p.time} dagi qabulingizni amalga oshira olmaydi. Noqulaylik uchun uzr soraymiz. Boshqa vaqtga yozilish: vaqtda.uz`,
  refund_cancel: (p: any) =>
    `Hurmatli ${p.client_name || "Mijoz"}! ${p.provider_name} kutilmagan texnik sabablarga kora ${formatUzDateForSms(p.date)} soat ${p.time} dagi bronni bekor qilishga majbur boldi. Oldindan tolovingiz 100% hisobingizga qaytarildi. Vaqtda ilovasi orqali boshqa vaqtni tanlashingiz mumkin.`,
  transfer_staff_cancel: (p: any) =>
    `Hurmatli ${p.client_name || "Mijoz"}! Usta ${p.staff_name} kutilmagan sabab tufayli bugungi qabulni bajara olmaydi. Qabulingizni boshqa mutaxassisga kochirish yoki bekor qilish uchun Vaqtda ilovasiga kiring.`,
  provider_cancel: (p: any) =>
    `Hurmatli ${p.client_name || "Mijoz"}! ${p.provider_name} tomonidan ${formatUzDateForSms(p.date)} ${p.time} dagi ${p.service_name} xizmatiga broningiz bekor qilindi. Tafsilotlar: Vaqtda ilovasida.`,
  waitlist_slot_opened: (p: any) =>
    `Xushxabar! ${p.provider_name} da ${formatUzDateForSms(p.date)} soat ${p.time} ga kutish royxatingiz boyicha bosh joy ochildi. Joyni band qilish uchun darhol Vaqtda ilovasiga kiring!`,
};

function normalizePhone(p: string): string {
  const digits = p.replace(/\D/g, "");
  if (digits.length === 9) return `998${digits}`;
  if (digits.length === 12 && digits.startsWith("998")) return digits;
  return digits;
}

let cachedEskizToken: string | null = null;
let tokenExpiresAt = 0;

async function getEskizToken(email: string, pass: string, force = false): Promise<string | null> {
  const now = Date.now();
  if (!force && cachedEskizToken && tokenExpiresAt > now) {
    return cachedEskizToken;
  }

  const formData = new FormData();
  formData.append("email", email);
  formData.append("password", pass);

  const res = await fetch(`${ESKIZ_API_BASE}/auth/login`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) return null;
  const json = await res.json();
  const token = json?.data?.token;
  if (token) {
    cachedEskizToken = token;
    tokenExpiresAt = Date.now() + 29 * 24 * 60 * 60 * 1000;
    return token;
  }
  return null;
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
    const ESKIZ_EMAIL =
      Deno.env.get("ESKIZ_EMAIL") ||
      Deno.env.get("EXPO_PUBLIC_ESKIZ_EMAIL") ||
      "smth7019@gmail.com";
    const ESKIZ_PASSWORD =
      Deno.env.get("ESKIZ_PASSWORD") ||
      Deno.env.get("EXPO_PUBLIC_ESKIZ_PASSWORD") ||
      "MBI4MwMCQ7nuNZ6MqXeAGFcNAHBuqqbxV888pPJP";
    const ESKIZ_FROM = Deno.env.get("ESKIZ_FROM") || "4546";

    const body = await req.json().catch(() => ({}));
    const phone = normalizePhone(String(body.phone ?? ""));
    const type = String(body.type ?? "registration");

    if (!phone || phone.length !== 12) {
      return json({ error: "invalid_phone" }, 400);
    }

    const templateFn = TEMPLATES[type] || TEMPLATES.registration;
    const message = body.message || templateFn(body);

    if (!ESKIZ_EMAIL || !ESKIZ_PASSWORD) {
      console.log(`[DEV / Mock SMS] To: +${phone}, Message: "${message}"`);
      return json({
        success: true,
        mock: true,
        message: "Mock SMS sent",
      });
    }

    let token = await getEskizToken(ESKIZ_EMAIL, ESKIZ_PASSWORD);
    if (!token) {
      return json({ error: "eskiz_auth_failed" }, 500);
    }

    const sendFormData = new FormData();
    sendFormData.append("mobile_phone", phone);
    sendFormData.append("message", message);
    sendFormData.append("from", ESKIZ_FROM);

    let res = await fetch(`${ESKIZ_API_BASE}/message/sms/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: sendFormData,
    });

    if (res.status === 401) {
      token = await getEskizToken(ESKIZ_EMAIL, ESKIZ_PASSWORD, true);
      if (token) {
        res = await fetch(`${ESKIZ_API_BASE}/message/sms/send`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: sendFormData,
        });
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return json({ error: "sms_send_failed", details: err }, 500);
    }

    const sendData = await res.json();
    return json({ success: true, id: sendData?.id, status: sendData?.status });
  } catch (err: any) {
    return json({ error: "server_error", message: err?.message }, 500);
  }
});
