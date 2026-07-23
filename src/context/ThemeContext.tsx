// Tema mexanizmi: dark (default) / light / system rejimlari.
// Faol palitra useColors() orqali olinadi; StyleSheet'lar makeThemedStyles bilan
// palitraga bog'lanadi. Tanlov AsyncStorage'da saqlanadi.
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { darkColors, lightColors, toneColors, type Colors, type Tone } from "@/constants/colors";

export type ThemeMode = "dark" | "light" | "system";
type Scheme = "dark" | "light";

const STORAGE_KEY = "vaqtda.themeMode";

type ThemeValue = {
  /** Foydalanuvchi tanlagan rejim (default: dark) */
  mode: ThemeMode;
  /** Amaldagi sxema — "system" rejimda qurilma sozlamasidan olinadi */
  scheme: Scheme;
  colors: Colors;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeValue>({
  mode: "dark",
  scheme: "dark",
  colors: darkColors,
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default dark — saqlangan tanlov yuklangach almashadi
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const systemScheme = useColorScheme();

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === "light" || saved === "system") setModeState(saved);
    });
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };

  const scheme: Scheme = mode === "system" ? (systemScheme === "light" ? "light" : "dark") : mode;

  const value = useMemo<ThemeValue>(
    () => ({ mode, scheme, colors: scheme === "light" ? lightColors : darkColors, setMode }),
    [mode, scheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

export function useColors(): Colors {
  return useContext(ThemeContext).colors;
}

// toneColors(colors) ning memoizatsiyalangan hook varianti
export function useToneColors(): Record<Tone, { text: string; container: string }> {
  const colors = useColors();
  return useMemo(() => toneColors(colors), [colors]);
}

// Palitraga bog'liq StyleSheet fabrikasi:
//   const useStyles = makeThemedStyles((colors) => StyleSheet.create({...}));
//   ... komponent ichida: const styles = useStyles();
export function makeThemedStyles<T>(factory: (colors: Colors) => T): () => T {
  return function useThemedStyles(): T {
    const colors = useColors();
    return useMemo(() => factory(colors), [colors]);
  };
}
