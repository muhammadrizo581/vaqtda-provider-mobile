// Telefon OTP yordamchilari — send-sms-otp (kod yaratadi) va provider-register
// (kodni tekshiradi) ikkalasi ham shu fayldan foydalanadi. Jadval: sms-otp.sql.

export const OTP_TTL_MS = 5 * 60 * 1000; // kod 5 daqiqa amal qiladi
export const OTP_RESEND_MS = 60 * 1000; // qayta so'rash — kamida 60 soniyadan keyin
export const OTP_MAX_ATTEMPTS = 5; // noto'g'ri urinishlar chegarasi

/** "+998 (90) 123-45-67" / "901234567" -> "998901234567" */
export function normalizePhone(p: string): string {
  const digits = p.replace(/\D/g, "");
  if (digits.length === 9) return `998${digits}`;
  return digits;
}

/** Kriptografik tasodifiy 4 xonali kod */
export function generateOtp(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 10000;
  return String(n).padStart(4, "0");
}

/** Kod bazada ochiq saqlanmaydi: telefon + kod + service_role kalitidan SHA-256 */
export async function hashOtp(phone: string, code: string): Promise<string> {
  const pepper = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${phone}:${code}:${pepper}`)
  );
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
