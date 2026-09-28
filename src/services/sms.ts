// SMS yuborish — faqat server (send-sms-otp Edge Function) orqali.
// Eskiz kalitlari ilovada saqlanmaydi: ilova faqat so'rov yuboradi, SMS matni va
// qabul qiluvchi raqamni server bazadan o'zi aniqlaydi (ixtiyoriy SMS yuborib bo'lmaydi).
import { supabase } from "@/lib/supabase";

export type SmsResult = { ok: true } | { ok: false; error: string };

async function invokeSms(body: Record<string, unknown>): Promise<SmsResult> {
  const { data, error } = await supabase.functions.invoke("send-sms-otp", { body });
  if (error) {
    // Xato kodi javob tanasida keladi ({error:"too_many_requests"} kabi)
    let code = "sms_send_failed";
    try {
      const payload = await (error as { context?: Response }).context?.json();
      if (payload?.error) code = String(payload.error);
    } catch {}
    return { ok: false, error: code };
  }
  return (data as { ok?: boolean } | null)?.ok ? { ok: true } : { ok: false, error: "sms_send_failed" };
}

/** Ro'yxatdan o'tish kodi — kod serverda yaratiladi va provider-register'da tekshiriladi */
export function sendRegistrationOtp(phone: string): Promise<SmsResult> {
  return invokeSms({ type: "registration", phone });
}

/** Bron bekor qilingach mijozga SMS — shablonni server bron holatiga qarab tanlaydi */
export function notifyBookingCancelled(bookingId: string): Promise<SmsResult> {
  return invokeSms({ type: "booking_cancelled", booking_id: bookingId });
}

/** Navbatdagi mijozga bo'sh joy ochilgani haqida SMS */
export function notifyWaitlistSlotOpened(waitlistId: string): Promise<SmsResult> {
  return invokeSms({ type: "waitlist_slot_opened", waitlist_id: waitlistId });
}

/** "998901234567" -> "+998 (90) 123-45-67" */
export function formatPhoneNumber(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 9) digits = `998${digits}`;
  if (digits.length === 12 && digits.startsWith("998")) {
    return `+998 (${digits.slice(3, 5)}) ${digits.slice(5, 8)}-${digits.slice(8, 10)}-${digits.slice(10, 12)}`;
  }
  return phone;
}
