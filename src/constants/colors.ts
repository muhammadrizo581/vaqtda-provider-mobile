// "Midnight Slate" dizayn tokenlari — saytdagi app/globals.css bilan bir xil.
// Komponentlarda hex yozish taqiqlangan: faqat shu tokenlar ishlatiladi.

export const colors = {
  background: "#0b1326",
  surface: "#0b1326",
  onSurface: "#dae2fd",
  onSurfaceVariant: "#c7c4d7",

  surfaceContainerLowest: "#060e20",
  surfaceContainerLow: "#131b2e",
  surfaceContainer: "#171f33",
  surfaceContainerHigh: "#222a3d",
  surfaceContainerHighest: "#2d3449",
  surfaceVariant: "#2d3449",

  outline: "#908fa0",
  outlineVariant: "#464554",

  primary: "#c0c1ff",
  onPrimary: "#1000a9",
  primaryContainer: "#8083ff",
  onPrimaryContainer: "#0d0096",

  secondary: "#7bd0ff",
  onSecondary: "#00354a",
  secondaryContainer: "#00a6e0",

  tertiary: "#ffb783",
  onTertiary: "#4f2500",
  tertiaryContainer: "#d97721",

  error: "#ffb4ab",
  onError: "#690005",
  errorContainer: "#93000a",
  onErrorContainer: "#ffdad6",
} as const;

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

export const toneColors: Record<Tone, { text: string; container: string }> = {
  primary: { text: colors.primary, container: colors.primaryContainer },
  secondary: { text: colors.secondary, container: colors.secondaryContainer },
  tertiary: { text: colors.tertiary, container: colors.tertiaryContainer },
  error: { text: colors.error, container: colors.errorContainer },
};
