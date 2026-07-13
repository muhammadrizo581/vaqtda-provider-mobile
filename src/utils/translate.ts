// Server-only: foydalanuvchi kiritgan matnni uz/ru/en ga tarjima qiladi.
// TEKIN, kalitsiz (Google'ning ochiq translate endpoint'i, sl=auto bilan
// manba tilini o'zi aniqlaydi). Xato bo'lsa — kiritilgan matnni qaytaradi.
//
// Eslatma: bu norasmiy endpoint — kelajakda pullik provayder (Grok/Gemini/DeepL)
// ga oson almashtirish mumkin (faqat shu faylni o'zgartirish kifoya).

export type Multilingual = { uz: string; ru: string; en: string };

async function gtranslate(text: string, target: "uz" | "ru" | "en"): Promise<string> {
  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=` +
    encodeURIComponent(text);
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`gtranslate ${target} ${res.status}`);
  const data = await res.json();
  // data[0] — segmentlar: [[ "tarjima", "asl", ... ], ...]
  if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error("gtranslate bad response");
  return data[0].map((seg: any) => (Array.isArray(seg) ? seg[0] : "")).join("");
}

// Kirim allaqachon ko'p tilli obyekt/JSON (ehtimol ichma-ich o'ralgan) bo'lishi
// mumkin. Bu holatda qayta tarjima qilib YANA o'ramaslik uchun eng ichkaridagi
// haqiqiy manba matnini ajratib olamiz (uz > ru > en tartibida).
function plainSource(input: unknown, depth = 0): string {
  if (input == null || depth > 8) return "";
  if (typeof input === "object") {
    const obj = input as Record<string, unknown>;
    for (const k of ["uz", "ru", "en"]) {
      const r = plainSource(obj[k], depth + 1);
      if (r) return r;
    }
    return "";
  }
  if (typeof input !== "string") return "";
  const s = input.trim();
  if (!s) return "";
  if (s.startsWith("{") && s.endsWith("}")) {
    try { return plainSource(JSON.parse(s), depth + 1); } catch { return s; }
  }
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
    try {
      const u = JSON.parse(s);
      if (typeof u === "string") return plainSource(u, depth + 1);
    } catch { /* tushib ketamiz */ }
  }
  return s;
}

export async function translateMultilingual(text: unknown): Promise<Multilingual> {
  const src = plainSource(text);
  if (!src) return { uz: "", ru: "", en: "" };

  try {
    const [uz, ru, en] = await Promise.all([
      gtranslate(src, "uz"),
      gtranslate(src, "ru"),
      gtranslate(src, "en"),
    ]);
    return { uz: uz || src, ru: ru || src, en: en || src };
  } catch (e) {
    console.error("translate failed:", e);
    return { uz: src, ru: src, en: src };
  }
}
