// "Zumrad" dizayn tokenlari — dizayn-reference: Vaqtda Midnight Slate.dc.html (Zumrad palitra).
// Komponentlarda hex yozish taqiqlangan: faqat shu tokenlar ishlatiladi.
// Faol palitra ThemeContext'dagi useColors() orqali olinadi — bu fayldan
// to'g'ridan-to'g'ri palitra import qilinmaydi (dark/light almashinuvi uchun).

// Dark palitra — asosiy (default) tema.
export const darkColors = {
  background: "#0c1310",
  surface: "#0c1310",
  onSurface: "#e2efe6",
  onSurfaceVariant: "#c4d0c6",

  surfaceContainerLowest: "#070d0a",
  surfaceContainerLow: "#121b16",
  surfaceContainer: "#16211b",
  surfaceContainerHigh: "#1f2d25",
  surfaceContainerHighest: "#2a3b31",
  surfaceVariant: "#2a3b31",

  outline: "#8fa094",
  outlineVariant: "#3e4e44",

  primary: "#3ecf8e", // zumrad
  // MUHIM: dark'da oq emas — to'q yashil (yorqin zumrad fonda oq matn kontrasti yetmaydi)
  onPrimary: "#052e1c",
  primaryContainer: "#3ecf8e",
  onPrimaryContainer: "#052e1c",

  secondary: "#e8c06a", // oltin (kutilmoqda statuslari)
  onSecondary: "#3d2e00",
  secondaryContainer: "#d4a034",

  tertiary: "#ff9d80", // marjon (tasdiq kutilmoqda)
  onTertiary: "#4a1500",
  tertiaryContainer: "#e6693c",

  error: "#ffb4ab",
  onError: "#690005",
  errorContainer: "#93000a",
  onErrorContainer: "#ffdad6",
} as const;

// Light palitra — dark bilan bir xil kalitlar, qiymatlar light rejim uchun.
export const lightColors: Colors = {
  background: "#f4f4ee",
  surface: "#ffffff",
  onSurface: "#1a201c",
  onSurfaceVariant: "#4f5951",

  surfaceContainerLowest: "#ffffff",
  surfaceContainerLow: "#edeee6",
  surfaceContainer: "#ffffff",
  surfaceContainerHigh: "#e7e9e0",
  surfaceContainerHighest: "#dadcd1",
  surfaceVariant: "#dadcd1",

  outline: "#717d74",
  outlineVariant: "#d3d8cf",

  primary: "#0e7a4a", // to'q zumrad
  onPrimary: "#ffffff", // light'da oq matn qaytadi
  primaryContainer: "#0e7a4a",
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
