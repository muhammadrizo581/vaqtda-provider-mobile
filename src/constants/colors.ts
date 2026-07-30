// "Indigo" dizayn tokenlari — neytral ko'k-qora yer, indigo aksent.
// Komponentlarda hex yozish taqiqlangan: faqat shu tokenlar ishlatiladi.
// Faol palitra ThemeContext'dagi useColors() orqali olinadi — bu fayldan
// to'g'ridan-to'g'ri palitra import qilinmaydi (dark/light almashinuvi uchun).

// Dark palitra — asosiy (default) tema.
export const darkColors = {
  background: "#0b0d12",
  surface: "#0b0d12",
  onSurface: "#e9ebf1",
  onSurfaceVariant: "#9aa1b0",

  surfaceContainerLowest: "#07090d",
  surfaceContainerLow: "#10131a",
  surfaceContainer: "#141822",
  surfaceContainerHigh: "#1a1f2b",
  surfaceContainerHighest: "#222836",
  surfaceVariant: "#222836",

  outline: "#8b93a5",
  outlineVariant: "#262c3a",

  primary: "#818cf8", // indigo aksent — qorong'i fonda tiniq
  onPrimary: "#0b0d12", // och indigo to'ldirish ustida qorong'i siyoh
  primaryContainer: "#818cf8",
  onPrimaryContainer: "#0b0d12",

  secondary: "#e6c266", // oltin (kutilmoqda statuslari)
  onSecondary: "#3a2e00",
  secondaryContainer: "#d4a942",

  tertiary: "#f0876a", // marjon (tasdiq kutilmoqda)
  onTertiary: "#4a1500",
  tertiaryContainer: "#e6693c",

  error: "#f28b80",
  onError: "#690005",
  errorContainer: "#93000a",
  onErrorContainer: "#ffdad6",
} as const;

// Light palitra — toza oq-neytral yer, to'q indigo aksent.
export const lightColors: Colors = {
  background: "#eef0f5",
  surface: "#ffffff",
  onSurface: "#171a21",
  onSurfaceVariant: "#5d6472",

  surfaceContainerLowest: "#ffffff",
  surfaceContainerLow: "#f3f4f8",
  surfaceContainer: "#ffffff",
  surfaceContainerHigh: "#e7eaf1",
  surfaceContainerHighest: "#dde1ea",
  surfaceVariant: "#e4e7ef",

  outline: "#737b8c",
  outlineVariant: "#dde1ea",

  primary: "#4f46e5", // to'q indigo — oq fonda kuchli kontrast
  onPrimary: "#ffffff",
  primaryContainer: "#4f46e5",
  onPrimaryContainer: "#ffffff",

  secondary: "#8a6a15",
  onSecondary: "#ffffff",
  secondaryContainer: "#c9992e",

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
