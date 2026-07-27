// "Yashil Grafit" dizayn tokenlari — yer yengil yashil-grafit, yashil aksent.
// Mijoz ilovasi (vaqtda-mobile) palitrasiga moslangan: primary yashil.
// Komponentlarda hex yozish taqiqlangan: faqat shu tokenlar ishlatiladi.
// Faol palitra ThemeContext'dagi useColors() orqali olinadi — bu fayldan
// to'g'ridan-to'g'ri palitra import qilinmaydi (dark/light almashinuvi uchun).

// Dark palitra — asosiy (default) tema.
export const darkColors = {
  background: "#0f1311",
  surface: "#0f1311",
  onSurface: "#ecefea",
  onSurfaceVariant: "#98a29a",

  surfaceContainerLowest: "#0a0d0b",
  surfaceContainerLow: "#141a16",
  surfaceContainer: "#181e1a",
  surfaceContainerHigh: "#1f2721",
  surfaceContainerHighest: "#27302a",
  surfaceVariant: "#27302a",

  outline: "#8a968c",
  outlineVariant: "#2a332c",

  primary: "#7bae85", // yashil aksent (mijoz ilovasi dark primary) — och yashil, qorong'i fonda tiniq
  onPrimary: "#0f1311", // och yashil to'ldirish ustida qorong'i siyoh
  primaryContainer: "#7bae85",
  onPrimaryContainer: "#0f1311",

  secondary: "#e8c06a", // oltin (kutilmoqda statuslari)
  onSecondary: "#3d2e00",
  secondaryContainer: "#d4a034",

  tertiary: "#f0876a", // marjon (tasdiq kutilmoqda)
  onTertiary: "#4a1500",
  tertiaryContainer: "#e6693c",

  error: "#f28b80",
  onError: "#690005",
  errorContainer: "#93000a",
  onErrorContainer: "#ffdad6",
} as const;

// Light palitra — dark bilan bir xil kalitlar, qiymatlar light rejim uchun.
export const lightColors: Colors = {
  background: "#f6f7f5",
  surface: "#ffffff",
  onSurface: "#181d19",
  onSurfaceVariant: "#6b7280",

  surfaceContainerLowest: "#ffffff",
  surfaceContainerLow: "#eff1ee",
  surfaceContainer: "#ffffff",
  surfaceContainerHigh: "#e8ebe7",
  surfaceContainerHighest: "#dee3dd",
  surfaceVariant: "#dee3dd",

  outline: "#7b857d",
  outlineVariant: "#e5e7eb",

  primary: "#4c8156", // to'q yashil (mijoz ilovasi light primary)
  onPrimary: "#ffffff",
  primaryContainer: "#4c8156",
  onPrimaryContainer: "#ffffff",

  secondary: "#8a6510",
  onSecondary: "#ffffff",
  secondaryContainer: "#c4962c",

  tertiary: "#b34f22",
  onTertiary: "#ffffff",
  tertiaryContainer: "#d66a3a",

  error: "#ba1a1a",
  onError: "#ffffff",
  errorContainer: "#ba1a1a",
  onErrorContainer: "#ffffff",
};

export type Colors = { [K in keyof typeof darkColors]: string };

// rgba yordamchisi — web'dagi `bg-primary-container/20` kabi shaffof fonlar uchun
export function alpha(hex: string, opacity: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export const radius = { sm: 4, md: 8, lg: 12, xl: 16, xxxl: 24 } as const;

export type Tone = "primary" | "secondary" | "tertiary" | "error";
export type BadgeTone = Tone | "muted";

// Palitraga bog'liq — faol palitra bilan chaqiriladi: toneColors(colors)[tone]
export function toneColors(colors: Colors): Record<Tone, { text: string; container: string }> {
  return {
    primary: { text: colors.primary, container: colors.primaryContainer },
    secondary: { text: colors.secondary, container: colors.secondaryContainer },
    tertiary: { text: colors.tertiary, container: colors.tertiaryContainer },
    error: { text: colors.error, container: colors.errorContainer },
  };
}
