// Tema mexanizmi: dark (default) / light / system rejimlari.
// Faol palitra useColors() orqali olinadi; StyleSheet'lar makeThemedStyles bilan
// palitraga bog'lanadi. Tanlov AsyncStorage'da saqlanadi.
import MaskedView from "@react-native-masked-view/masked-view";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Appearance, Dimensions, Image, StyleSheet, View, useColorScheme } from "react-native";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { captureRef, captureScreen } from "react-native-view-shot";
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
  /** `at` berilsa, yangi tema shu nuqtadan doira bo'lib ochiladi (circular reveal) */
  setMode: (mode: ThemeMode, at?: { x: number; y: number }) => void;
};

const ThemeContext = createContext<ThemeValue>({
  mode: "dark",
  scheme: "dark",
  colors: darkColors,
  setMode: () => {},
});

// Faol reveal: bosilgan nuqta, qo'llanadigan yangi rejim va (tayyor bo'lgach)
// eski tema surati — uri kelguncha overlay faqat "quyosh porlashi"ni ko'rsatadi
type Reveal = { x: number; y: number; next: ThemeMode; uri: string | null };

// Suratlar 2x masshtabda olinadi (3x native o'rniga) — encode/decode ~2x tezroq,
// vaqtinchalik overlay uchun sifat farqi sezilmaydi
function snapshotSize() {
  const { width, height } = Dimensions.get("window");
  return { width: width * 2, height: height * 2 };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default dark — saqlangan tanlov yuklangach almashadi
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const contentRef = useRef<View>(null);
  const systemScheme = useColorScheme();

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === "light" || saved === "system") setModeState(saved);
    });
  }, []);

  const scheme: Scheme = mode === "system" ? (systemScheme === "light" ? "light" : "dark") : mode;

  const setMode = (next: ThemeMode, at?: { x: number; y: number }) => {
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
    const nextScheme: Scheme = next === "system" ? (systemScheme === "light" ? "light" : "dark") : next;
    if (!at || nextScheme === scheme || reveal) {
      setModeState(next);
      return;
    }
    // Overlay darhol chiqadi (porlash boshlanadi), eski tema surati tayyor
    // bo'lgach ekranni qoplaydi; yangi tema surat OSTIDA qo'llanadi
    setReveal({ x: at.x, y: at.y, next, uri: null });
    captureScreen({ format: "jpg", quality: 0.8, ...snapshotSize() })
      .then((uri) => setReveal((r) => (r ? { ...r, uri } : r)))
      .catch(() => {
        setModeState(next);
        setReveal(null);
      });
  };

  // Native qatlam (NativeTabs, GlassView, alert, klaviatura, picker) ham
  // app'dagi tanlovga ergashsin — aks holda ular system rejimiga qarab chiziladi
  useEffect(() => {
    try {
      Appearance.setColorScheme(mode === "system" ? null : mode);
    } catch {
      // web'da setColorScheme bo'lmasligi mumkin — e'tiborsiz qoldiramiz
    }
  }, [mode]);

  const value = useMemo<ThemeValue>(
    () => ({ mode, scheme, colors: scheme === "light" ? lightColors : darkColors, setMode }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, scheme, reveal]
  );

  return (
    <ThemeContext.Provider value={value}>
      <View ref={contentRef} collapsable={false} style={{ flex: 1 }}>
        {children}
      </View>
      {reveal && (
        <ThemeRevealOverlay
          reveal={reveal}
          contentRef={contentRef}
          onCovered={() => setModeState(reveal.next)}
          onDone={() => setReveal(null)}
        />
      )}
    </ThemeContext.Provider>
  );
}

// Telegram uslubidagi reveal: eski tema surati ekranni qoplaydi (freeze), ostida
// yangi tema qo'llanib, glass effektlar tinchiydi; so'ng yangi temaning ham surati
// olinadi va bosilgan nuqtadan faqat transform-scale bilan (layout'siz, silliq)
// doira bo'lib ochiladi — quyosh chiqqanday.
function ThemeRevealOverlay({
  reveal,
  contentRef,
  onCovered,
  onDone,
}: {
  reveal: Reveal;
  contentRef: React.RefObject<View | null>;
  onCovered: () => void;
  onDone: () => void;
}) {
  const { width, height } = Dimensions.get("window");
  // Bosilgan nuqtadan eng uzoq burchakkacha masofa — doira shu radiusgacha o'sadi
  const maxR = Math.ceil(
    Math.hypot(Math.max(reveal.x, width - reveal.x), Math.max(reveal.y, height - reveal.y))
  );
  const [newUri, setNewUri] = useState<string | null>(null);
  const scale = useSharedValue(0);
  const glow = useSharedValue(0);
  const fade = useSharedValue(1);
  const startedRef = useRef(false);

  // Bosilgan zahoti nuqtadan iliq "quyosh nuri" tarqaladi — tayyorgarlik
  // (surat olish, tema almashishi) shu harakat ortida sezilmaydi
  useEffect(() => {
    glow.value = withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) });
    // Biror qadam osilib qolsa ham overlay ekranni band qilib qolmasin
    const safety = setTimeout(() => {
      onCovered();
      onDone();
    }, 3000);
    return () => clearTimeout(safety);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Eski surat yuklanib ekranni qoplagach: yangi tema qo'llanadi, keyingi
  // kadrlar chizilib ulgurishi uchun qisqa kutiladi, so'ng kontentning
  // (overlay'siz) surati olinadi
  const handleCoverLoaded = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    onCovered();
    setTimeout(() => {
      const node = contentRef.current;
      if (!node) {
        onDone();
        return;
      }
      captureRef(node, { format: "jpg", quality: 0.8, ...snapshotSize() })
        .then(setNewUri)
        .catch(() => onDone());
    }, 160);
  };

  // Yangi surat ham tayyor bo'lgach doira ochiladi: sekin boshlanib, sekin
  // tugaydigan easing — boshida "sakrash" bo'lmaydi; tugagach overlay keskin
  // emas, qisqa fade bilan olib tashlanadi
  const startReveal = () => {
    scale.value = withTiming(1, { duration: 650, easing: Easing.inOut(Easing.cubic) }, (finished) => {
      if (finished) {
        fade.value = withTiming(0, { duration: 150 }, (f) => {
          if (f) runOnJS(onDone)();
        });
      }
    });
  };

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - glow.value),
    transform: [{ scale: 0.3 + glow.value * 5 }],
  }));

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
  }));

  return (
    // pointerEvents="auto": o'tish paytida ostidagi UI bosilmasin
    <Animated.View style={[StyleSheet.absoluteFill, fadeStyle]} pointerEvents="auto">
      {reveal.uri && (
        <Image
          source={{ uri: reveal.uri }}
          style={StyleSheet.absoluteFill}
          fadeDuration={0}
          onLoad={handleCoverLoaded}
        />
      )}
      <Animated.View
        style={[
          {
            position: "absolute",
            left: reveal.x - 48,
            top: reveal.y - 48,
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: "rgba(255,184,48,0.55)",
            shadowColor: "#ffb830",
            shadowOpacity: 0.9,
            shadowRadius: 28,
            shadowOffset: { width: 0, height: 0 },
          },
          glowStyle,
        ]}
      />
      {newUri && (
        <MaskedView
          style={StyleSheet.absoluteFill}
          maskElement={
            <View style={{ flex: 1, backgroundColor: "transparent" }}>
              <Animated.View
                style={[
                  {
                    position: "absolute",
                    left: reveal.x - maxR,
                    top: reveal.y - maxR,
                    width: maxR * 2,
                    height: maxR * 2,
                    borderRadius: maxR,
                    backgroundColor: "#000",
                    // Soyalar mask alfasiga qo'shiladi — doira cheti yumshoq
                    // (feathered) bo'lib, o'tish silliqroq ko'rinadi
                    shadowColor: "#000",
                    shadowOpacity: 1,
                    shadowRadius: 30,
                    shadowOffset: { width: 0, height: 0 },
                  },
                  circleStyle,
                ]}
              />
            </View>
          }
        >
          <Image
            source={{ uri: newUri }}
            style={StyleSheet.absoluteFill}
            fadeDuration={0}
            onLoad={startReveal}
          />
        </MaskedView>
      )}
    </Animated.View>
  );
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
