// Kasbga mos kategoriya rasmlari — ilova ichida (assets/images/categories), oflayn ishlaydi.
// DB'dagi categories.image_url bir nechta kategoriyada noto'g'ri yoki bir xil rasm
// (masalan klinikada go'zallik saloni surati) — shuning uchun mahalliy rasm ustun turadi,
// u yo'q bo'lsa DB rasmi, u ham bo'lmasa chaqiruvchi kategoriya ikonkasini ko'rsatadi.

const CATEGORY_IMAGES: Record<string, number> = {
  // Korporativ / tibbiyot
  klinika: require("@/assets/images/categories/klinika.png"),
  stomatolog: require("@/assets/images/categories/stomatolog.png"),
  // Usta va individual xizmatlar
  sartaroshxona: require("@/assets/images/categories/sartaroshxona.png"),
  "gozallik-saloni": require("@/assets/images/categories/gozallik-saloni.png"),
  tirnoq: require("@/assets/images/categories/tirnoq.png"),
  kosmetolog: require("@/assets/images/categories/kosmetolog.png"),
  epilyatsiya: require("@/assets/images/categories/epilyatsiya.png"),
  "kiprik-qosh": require("@/assets/images/categories/kiprik-qosh.png"),
  fotostudiya: require("@/assets/images/categories/fotostudiya.png"),
  psixolog: require("@/assets/images/categories/psixolog.png"),
  // Restoran, ovqatlanish va zallar
  restoran: require("@/assets/images/categories/restoran.png"),
  kafe: require("@/assets/images/categories/kafe.png"),
  karaoke: require("@/assets/images/categories/karaoke.png"),
  toyxona: require("@/assets/images/categories/toyxona.png"),
  // Kunlik va sutkalik ijara
  mehmonxona: require("@/assets/images/categories/mehmonxona.png"),
  kvartira: require("@/assets/images/categories/kvartira.png"),
  dacha: require("@/assets/images/categories/dacha.png"),
  "avto-ijara": require("@/assets/images/categories/avto-ijara.png"),
  // Avto servis va parvarish
  avtomoyka: require("@/assets/images/categories/avtomoyka.png"),
  detailing: require("@/assets/images/categories/detailing.png"),
  tonirovka: require("@/assets/images/categories/tonirovka.png"),
  avtoservis: require("@/assets/images/categories/avtoservis.png"),
};

/** expo-image `source` uchun: mahalliy rasm → DB rasmi → null (ikonka). */
export function getCategoryImage(
  slug?: string | null,
  imageUrl?: string | null
): number | { uri: string } | null {
  if (slug && CATEGORY_IMAGES[slug]) return CATEGORY_IMAGES[slug];
  return imageUrl ? { uri: imageUrl } : null;
}
