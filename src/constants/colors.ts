// "Grafit Moviy" dizayn tokenlari — yer butunlay neytral grafit, moviy faqat aksent.
// Komponentlarda hex yozish taqiqlangan: faqat shu tokenlar ishlatiladi.
// Faol palitra ThemeContext'dagi useColors() orqali olinadi — bu fayldan
// to'g'ridan-to'g'ri palitra import qilinmaydi (dark/light almashinuvi uchun).

// Dark palitra — asosiy (default) tema.
export const darkColors = {
  background: "#0e1113",
  surface: "#0e1113",
  onSurface: "#e9edef",
  onSurfaceVariant: "#9ba4aa",

  surfaceContainerLowest: "#0a0c0e",
  surfaceContainerLow: "#14171a",
  surfaceContainer: "#171b1e",
  surfaceContainerHigh: "#1e2327",
  surfaceContainerHighest: "#262c30",
  surfaceVariant: "#262c30",

  outline: "#8f9aa0",
  outlineVariant: "#2b3237",

  primary: "#3b82f6", // moviy (yashil aksent rad etildi — grafit fonda tiniq ko'k)
  onPrimary: "#ffffff",
  primaryContainer: "#3b82f6",
  onPrimaryContainer: "#ffffff",

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
  background: "#f4f5f5",
  surface: "#ffffff",
  onSurface: "#181c1e",
  onSurfaceVariant: "#4f585d",

  surfaceContainerLowest: "#ffffff",
  surfaceContainerLow: "#eceeef",
  surfaceContainer: "#ffffff",
  surfaceContainerHigh: "#e5e8ea",
  surfaceContainerHighest: "#d8dcde",
  surfaceVariant: "#d8dcde",

  outline: "#70797e",
  outlineVariant: "#d0d6d9",

  primary: "#1e66c7", // to'q moviy
  onPrimary: "#ffffff",
  primaryContainer: "#1e66c7",
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
