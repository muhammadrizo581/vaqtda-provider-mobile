// Oddiy toast — web'dagi pastki qismda chiqadigan xabarnoma o'rnida.
// iOS 26 da Liquid Glass yuzada ko'rsatiladi.
import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated, StyleSheet, Text, useAnimatedValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassSurface, liquidGlass } from "@/components/pv/ui";
import { alpha, colors, radius } from "@/constants/colors";

type ToastKind = "success" | "error";

interface ToastContextType {
  showToast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ message: string; kind: ToastKind } | null>(null);
  const progress = useAnimatedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const showToast = useCallback(
    (message: string, kind: ToastKind = "success") => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ message, kind });
      Animated.timing(progress, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(progress, { toValue: 0, duration: 240, useNativeDriver: true }).start(() =>
          setToast(null)
        );
      }, 2600);
    },
    [progress]
  );

  const isError = toast?.kind === "error";

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.wrap,
            {
              bottom: insets.bottom + 72,
              // opacity 0 glass effektni butunlay o'chiradi — shuning uchun 0.01 dan boshlaymiz
              opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.01, 1] }),
              transform: [
                { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
              ],
            },
          ]}
        >
          <GlassSurface
            style={styles.toast}
            fallbackStyle={{
              backgroundColor: isError ? colors.errorContainer : colors.primary,
            }}
            tintColor={isError ? alpha(colors.errorContainer, 0.75) : alpha(colors.primary, 0.75)}
          >
            <Text
              style={[
                styles.toastText,
                {
                  color: isError
                    ? liquidGlass
                      ? colors.onSurface
                      : colors.onErrorContainer
                    : colors.onPrimary,
                },
              ]}
            >
              {toast.message}
            </Text>
          </GlassSurface>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 20,
    right: 20,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  toast: {
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    overflow: "hidden",
  },
  toastText: { fontSize: 14, fontWeight: "600", textAlign: "center" },
});
