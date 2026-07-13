// Chat yordamchilari: vaqt formatlash + xabardan rasm URL'ini aniqlash.
import type { TKey } from "@/locales/uz";

type TFunc = (key: TKey) => string;

// Ro'yxat/xabar vaqti: bugun — HH:MM, kecha — "Kecha", undan oldin — DD.MM
export function formatChatTime(iso: string, t: TFunc): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (d.toDateString() === now.toDateString()) return hhmm;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return t("chat.yesterday");
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Kun ajratgichi uchun: "Bugun" / "Kecha" / DD.MM.YYYY
export function formatChatDay(iso: string, t: TFunc): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return t("chat.today");
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return t("chat.yesterday");
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

// Asosiy manba — image_url ustuni; lekin qarshi tomon rasmni body'ga oddiy URL
// qilib yuborgan bo'lsa ham (eski/xato klient), uni rasm sifatida ko'rsatamiz.
const IMG_URL_RE = /^https?:\/\/\S+\.(jpe?g|png|gif|webp|avif|heic)(\?\S*)?$/i;

export function chatImageUrl(msg: { body?: string | null; image_url?: string | null }): string | null {
  if (msg.image_url) return msg.image_url;
  const b = (msg.body || "").trim();
  if (IMG_URL_RE.test(b)) return b;
  return null;
}

// Ro'yxat preview'i uchun: matn aslida rasm URL'imi
export function isImageText(text: string | null): boolean {
  if (!text) return false;
  return text === "📷" || IMG_URL_RE.test(text.trim());
}
