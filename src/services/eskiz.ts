// Eskiz.uz SMS shlyuzi integratsiyasi va OTP xizmati
// Hujjat: https://documenter.getpostman.com/view/663428/RzfmES4z?version=latest

import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Eskiz API URL va kalitlari ──────────────────────────────────────────
const ESKIZ_API_BASE = "https://notify.eskiz.uz/api";
const TOKEN_STORAGE_KEY = "eskiz_bearer_token";
const TOKEN_EXPIRY_KEY = "eskiz_bearer_expiry";

// Standart Eskiz Sender ID ("4546" yoki maxsus tasdiqlangan nickname)
export const DEFAULT_SENDER_ID = "4546";

const UZ_MONTHS = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
];

export function formatUzDateForSms(dateStr: string): string {
  if (!dateStr) return "";
  if (dateStr.includes("-") && dateStr.length === 10) {
    const parts = dateStr.split("-");
    const day = parseInt(parts[2], 10);
    const month = parseInt(parts[1], 10) - 1;
    return `${day}-${UZ_MONTHS[month] || "oy"}`;
  }
  return dateStr;
}

// ── Foydalanuvchi bergan rasmiy SMS shablonlari ──────────────────────────
export const ESKIZ_TEMPLATES = {
  // 1. Ro'yxatdan o'tish (Register OTP)
  registration: (code: string | number) =>
    `Vaqtda ilovasi orqali ro'yxatdan o'tish uchun tasdiqlash kodi: ${code}. Kodni hech kimga bermang!`,

  // 2. Tizimga kirish (Login OTP)
  login: (code: string | number) =>
    `Vaqtda ilovasiga kirish uchun tasdiqlash kodi: ${code}. Kodni hech kimga bermang!`,

  // 3. Parolni tiklash (Forgot Password OTP)
  passwordReset: (code: string | number) =>
    `Vaqtda platformasida parolni tiklash uchun tasdiqlash kodi: ${code}. Kodni hech kimga bermang!`,

  // 4. Yangi telefon raqamni tasdiqlash (Phone Update OTP)
  phoneUpdate: (code: string | number) =>
    `Vaqtda ilovasida yangi telefon raqamni tasdiqlash uchun kod: ${code}. Kodni hech kimga bermang!`,

  // 5. Kutilmagan sababga ko'ra bekor qilinishi (Standart uzr bilan)
  unexpectedCancel: (clientName: string, providerName: string, date: string, time: string) =>
    `Hurmatli ${clientName || "Mijoz"}! ${providerName} mutaxassisi kutilmagan favqulodda sababga kora ${formatUzDateForSms(date)} soat ${time} dagi qabulingizni amalga oshira olmaydi. Noqulaylik uchun uzr soraymiz. Boshqa vaqtga yozilish: vaqtda.uz`,

  // 6. To'lov qaytarilishi bilan birga (Refund on Cancel)
  refundCancel: (clientName: string, providerName: string, date: string, time: string) =>
    `Hurmatli ${clientName || "Mijoz"}! ${providerName} kutilmagan texnik sabablarga kora ${formatUzDateForSms(date)} soat ${time} dagi bronni bekor qilishga majbur boldi. Oldindan tolovingiz 100% hisobingizga qaytarildi. Vaqtda ilovasi orqali boshqa vaqtni tanlashingiz mumkin.`,

  // 7. Navbatni boshqa mutaxassisga ko'chirish taklifi bilan
  transferStaffCancel: (clientName: string, staffName: string) =>
    `Hurmatli ${clientName || "Mijoz"}! Usta ${staffName} kutilmagan sabab tufayli bugungi qabulni bajara olmaydi. Qabulingizni boshqa mutaxassisga kochirish yoki bekor qilish uchun Vaqtda ilovasiga kiring.`,

  // 8. Provayder / Salon tomonidan bekor qilinganda
  providerCancel: (
    clientName: string,
    providerName: string,
    date: string,
    time: string,
    serviceName: string
  ) =>
    `Hurmatli ${clientName || "Mijoz"}! ${providerName} tomonidan ${formatUzDateForSms(date)} ${time} dagi ${serviceName} xizmatiga broningiz bekor qilindi. Tafsilotlar: Vaqtda ilovasida.`,

  // 9. Bo'sh joy ochilganda (Kutish ro'yxati / Waitlist)
  waitlistSlotOpened: (providerName: string, date: string, time: string) =>
    `Xushxabar! ${providerName} da ${formatUzDateForSms(date)} soat ${time} ga kutish royxatingiz boyicha bosh joy ochildi. Joyni band qilish uchun darhol Vaqtda ilovasiga kiring!`,
} as const;

export type EskizTemplateType = keyof typeof ESKIZ_TEMPLATES;

// ── Eskiz Javob Turlari ──────────────────────────────────────────────────
export interface EskizAuthResponse {
  message: string;
  data: {
    token: string;
  };
  token_type: string;
}

export interface EskizSendResponse {
  id?: string;
  message?: string;
  status?: string;
  error?: string;
}

export interface EskizUserResponse {
  status: string;
  data: {
    id: number;
    name: string;
    email: string;
    role: string;
    status: string;
    balance: number;
    is_vip: boolean;
  };
}

export interface EskizLimitResponse {
  status: string;
  data: {
    balance: number;
  };
}

// ── Xotiradagi token keshi ───────────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiresAt: number | null = null;

// ── Telefon raqamni tozalash va formatlash ───────────────────────────────
/**
 * Har qanday kiritilgan telefon raqamini Eskiz talab qiladigan formatga keltiradi:
 * Masalan: "+998 (90) 123-45-67" -> "998901234567"
 *          "901234567" -> "998901234567"
 */
export function normalizePhoneNumber(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, "");
  if (digitsOnly.length === 9) {
    return `998${digitsOnly}`;
  }
  if (digitsOnly.length === 12 && digitsOnly.startsWith("998")) {
    return digitsOnly;
  }
  return digitsOnly;
}

/**
 * Telefon raqamini vizual chiroyli formatga o'tkazish:
 * "998901234567" -> "+998 (90) 123-45-67"
 */
export function formatPhoneNumber(phone: string): string {
  const clean = normalizePhoneNumber(phone);
  if (clean.length === 12 && clean.startsWith("998")) {
    const code = clean.slice(3, 5);
    const p1 = clean.slice(5, 8);
    const p2 = clean.slice(8, 10);
    const p3 = clean.slice(10, 12);
    return `+998 (${code}) ${p1}-${p2}-${p3}`;
  }
  return phone;
}

// ── Tasodifiy 4 xonali OTP yaratish ──────────────────────────────────────
export function generateOtp(length = 4): string {
  if (length === 4) {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }
  if (length === 6) {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
  let code = "";
  for (let i = 0; i < length; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

// ── Eskiz API mijozi ─────────────────────────────────────────────────────
export class EskizService {
  private static email = process.env.EXPO_PUBLIC_ESKIZ_EMAIL || "smth7019@gmail.com";
  private static password =
    process.env.EXPO_PUBLIC_ESKIZ_PASSWORD || "MBI4MwMCQ7nuNZ6MqXeAGFcNAHBuqqbxV888pPJP";
  private static senderId = process.env.EXPO_PUBLIC_ESKIZ_FROM || "4546";

  /**
   * Eskiz hisob ma'lumotlarini sozlash (ixtiyoriy, agar env dan boshqa bo'lsa)
   */
  static configure(credentials: { email?: string; password?: string; senderId?: string }) {
    if (credentials.email) this.email = credentials.email;
    if (credentials.password) this.password = credentials.password;
    if (credentials.senderId) this.senderId = credentials.senderId;
  }

  /**
   * Eskiz Bearer tokenni olish (saqlangan keshdan yoki qayta login qilib)
   */
  static async getToken(forceRefresh = false): Promise<string | null> {
    const now = Date.now();

    // 1) Agar keshda mavjud bo'lsa va muddati o'tmagan bo'lsa
    if (!forceRefresh && cachedToken && tokenExpiresAt && tokenExpiresAt > now) {
      return cachedToken;
    }

    // 2) AsyncStorage dan tekshirish
    if (!forceRefresh) {
      try {
        const storedToken = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
        const storedExpiry = await AsyncStorage.getItem(TOKEN_EXPIRY_KEY);
        if (storedToken && storedExpiry) {
          const expTime = parseInt(storedExpiry, 10);
          if (expTime > now) {
            cachedToken = storedToken;
            tokenExpiresAt = expTime;
            return storedToken;
          }
        }
      } catch (e) {
        console.warn("[EskizService] AsyncStorage o'qishda xato:", e);
      }
    }

    // 3) Yangi token olish (Login)
    if (!this.email || !this.password) {
      console.warn("[EskizService] Eskiz email yoki password sozlanmagan");
      return null;
    }

    try {
      const formData = new FormData();
      formData.append("email", this.email.trim());
      formData.append("password", this.password);

      const response = await fetch(`${ESKIZ_API_BASE}/auth/login`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        console.error("[EskizService] Login xatosi:", response.status, errText);
        return null;
      }

      const resData = (await response.json()) as EskizAuthResponse;
      const token = resData?.data?.token;

      if (token) {
        cachedToken = token;
        // Token muddati: 30 kun (29 kunga keshlaymiz, xavfsizlik uchun)
        const expiry = Date.now() + 29 * 24 * 60 * 60 * 1000;
        tokenExpiresAt = expiry;

        await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token).catch(() => {});
        await AsyncStorage.setItem(TOKEN_EXPIRY_KEY, expiry.toString()).catch(() => {});
        return token;
      }
    } catch (e) {
      console.error("[EskizService] Login so'rovi amalga oshmadi:", e);
    }

    return null;
  }

  /**
   * SMS yuborish asosiy metodi
   */
  static async sendSms({
    phone,
    message,
    from,
  }: {
    phone: string;
    message: string;
    from?: string;
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    const formattedPhone = normalizePhoneNumber(phone);
    if (!formattedPhone || formattedPhone.length !== 12) {
      return { success: false, error: "invalid_phone_number" };
    }

    const sender = from || this.senderId;

    // Tokenni olamiz
    let token = await this.getToken();

    if (!token) {
      console.info(
        `[Eskiz DEV / Simulyatsiya] Raqam: +${formattedPhone}, Xabar: "${message}", Sender: ${sender}`
      );
      return {
        success: true,
        id: `dev-mock-${Date.now()}`,
      };
    }

    try {
      const sendReq = async (authToken: string) => {
        const formData = new FormData();
        formData.append("mobile_phone", formattedPhone);
        formData.append("message", message);
        formData.append("from", sender);

        return await fetch(`${ESKIZ_API_BASE}/message/sms/send`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          body: formData,
        });
      };

      let response = await sendReq(token);

      // Agar 401 Unauthorized kelsa, tokenni majburiy yangilab qayta urinib ko'ramiz
      if (response.status === 401) {
        token = await this.getToken(true);
        if (token) {
          response = await sendReq(token);
        }
      }

      if (!response.ok) {
        const errJson = (await response.json().catch(() => ({}))) as { message?: string };
        const errMsg = errJson?.message || `HTTP ${response.status}`;
        console.error("[EskizService] SMS yuborishda xato:", errMsg);
        return { success: false, error: errMsg };
      }

      const resData = (await response.json()) as EskizSendResponse;
      return {
        success: resData.status === "waiting" || resData.status === "success" || !!resData.id,
        id: resData.id,
      };
    } catch (e: any) {
      console.error("[EskizService] SMS so'rovi amalga oshmadi:", e);
      return { success: false, error: e?.message || "network_error" };
    }
  }

  // ── 1. Ro'yxatdan o'tish uchun OTP SMS ──────────────────────────────
  static async sendRegistrationOtp(
    phone: string,
    code: string | number
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    const message = ESKIZ_TEMPLATES.registration(code);
    return this.sendSms({ phone, message });
  }

  // 2. Tizimga kirish uchun OTP SMS ────────────────────────────────────
  static async sendLoginOtp(
    phone: string,
    code: string | number
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    const message = ESKIZ_TEMPLATES.login(code);
    return this.sendSms({ phone, message });
  }

  // 3. Parolni tiklash uchun OTP SMS ───────────────────────────────────
  static async sendPasswordResetOtp(
    phone: string,
    code: string | number
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    const message = ESKIZ_TEMPLATES.passwordReset(code);
    return this.sendSms({ phone, message });
  }

  // 4. Yangi telefon raqamni tasdiqlash uchun OTP SMS ──────────────────
  static async sendPhoneUpdateOtp(
    phone: string,
    code: string | number
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    const message = ESKIZ_TEMPLATES.phoneUpdate(code);
    return this.sendSms({ phone, message });
  }

  // 5. Kutilmagan favqulodda sababga ko'ra bekor qilinishi ──────────────
  static async sendUnexpectedCancelSms({
    phone,
    clientName,
    providerName,
    date,
    time,
  }: {
    phone: string;
    clientName: string;
    providerName: string;
    date: string;
    time: string;
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    const message = ESKIZ_TEMPLATES.unexpectedCancel(clientName, providerName, date, time);
    return this.sendSms({ phone, message });
  }

  // 6. To'lov qaytarilishi bilan birga bekor qilinganda ─────────────────
  static async sendRefundCancelSms({
    phone,
    clientName,
    providerName,
    date,
    time,
  }: {
    phone: string;
    clientName: string;
    providerName: string;
    date: string;
    time: string;
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    const message = ESKIZ_TEMPLATES.refundCancel(clientName, providerName, date, time);
    return this.sendSms({ phone, message });
  }

  // 7. Navbatni boshqa mutaxassisga ko'chirish taklifi bilan ────────────
  static async sendTransferStaffCancelSms({
    phone,
    clientName,
    staffName,
  }: {
    phone: string;
    clientName: string;
    staffName: string;
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    const message = ESKIZ_TEMPLATES.transferStaffCancel(clientName, staffName);
    return this.sendSms({ phone, message });
  }

  // 8. Provayder / Salon tomonidan bekor qilinganda ─────────────────────
  static async sendProviderCancelSms({
    phone,
    clientName,
    providerName,
    date,
    time,
    serviceName,
  }: {
    phone: string;
    clientName: string;
    providerName: string;
    date: string;
    time: string;
    serviceName: string;
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    const message = ESKIZ_TEMPLATES.providerCancel(
      clientName,
      providerName,
      date,
      time,
      serviceName
    );
    return this.sendSms({ phone, message });
  }

  // 9. Bo'sh joy ochilganda (Kutish ro'yxati / Waitlist) ────────────────
  static async sendWaitlistSlotOpenedSms({
    phone,
    providerName,
    date,
    time,
  }: {
    phone: string;
    providerName: string;
    date: string;
    time: string;
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    const message = ESKIZ_TEMPLATES.waitlistSlotOpened(providerName, date, time);
    return this.sendSms({ phone, message });
  }

  // ── Foydalanuvchi hisob balansi ─────────────────────────────────────
  static async getBalance(): Promise<number | null> {
    const token = await this.getToken();
    if (!token) return null;

    try {
      const res = await fetch(`${ESKIZ_API_BASE}/user/get-limit`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = (await res.json()) as EskizLimitResponse;
        return data?.data?.balance ?? null;
      }
    } catch (e) {
      console.warn("[EskizService] Balansni olishda xato:", e);
    }
    return null;
  }
}
