// Ko'p tilli maydonlardan ({en,ru,uz}) FAQAT o'zbek yoki rus matnini tanlaydi.
// Ingliz ko'rsatilmaydi. Xom JSON HECH QACHON qaytarilmaydi (bo'sh bo'lsa "").
//
// MUHIM: ma'lumot ba'zan ICHMA-ICH o'ralib qoladi (masalan
//   { uz: '{"uz":"Toshkent",...}' }  yoki ikki-uch qavat). Shu sabab quyidagi
// resolver REKURSIV ishlaydi: har qanday qavatdagi xom JSONni ochib, eng
// ichkaridagi haqiqiy matnni topadi.

type Lang = "uz" | "ru" | "en";
type Localized = { en?: string; ru?: string; uz?: string } | string | null | undefined;

// Joriy til (LanguageProvider o'rnatadi). lang berilmasa shu ishlatiladi.
let currentLang: Lang = "uz";
export function setLocalizeLang(l: Lang) { currentLang = l; }

// Matn JSON obyektga o'xshaydimi? ({ ... } yoki "{...}")
function looksLikeJson(s: string): boolean {
  return s.startsWith("{") && s.endsWith("}");
}

// Rekursiv: qiymatni (obyekt yoki satr, bir necha qavat o'ralgan bo'lsa ham)
// ochib, joriy tilga mos haqiqiy matnni qaytaradi. Faqat uz/ru (ingliz emas).
function resolve(value: any, lang: Lang, depth = 0): string {
  if (value == null || depth > 8) return "";

  // Obyekt bo'lsa: joriy til, keyin ikkinchisi — har birini rekursiv ochamiz.
  if (typeof value === "object") {
    const order = lang === "ru" ? ["ru", "uz"] : ["uz", "ru"];
    for (const k of order) {
      const r = resolve(value[k], lang, depth + 1);
      if (r) return r;
    }
    return "";
  }

  if (typeof value !== "string") return String(value);

  let s = value.trim();
  if (!s) return "";

  // Double-stringified: '"...."' — tirnoqlarni olib tashlaymiz.
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
    try {
      const unquoted = JSON.parse(s);
      if (typeof unquoted === "string") return resolve(unquoted, lang, depth + 1);
    } catch {
      return resolve(s.slice(1, -1), lang, depth + 1);
    }
  }

  // JSON obyekt ko'rinishidagi satr — ochib, ichidan rekursiv qidiramiz.
  if (looksLikeJson(s)) {
    try {
      return resolve(JSON.parse(s), lang, depth + 1);
    } catch {
      // Buzuq JSON — regex bilan uz/ru qiymatini sug'urib olamiz.
      const order = lang === "ru" ? ["ru", "uz"] : ["uz", "ru"];
      for (const k of order) {
        const m = s.match(new RegExp(`"${k}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
        if (m && m[1] && m[1].trim()) return resolve(m[1], lang, depth + 1);
      }
      return "";
    }
  }

  // Oddiy matn — shu.
  return s;
}

export function localize(value: Localized, lang: Lang = currentLang): string {
  return resolve(value, lang);
}
