// Ildiz layout: kontekst provayderlar + auth guard + kirish intro animatsiyasi.
// Saytdagi app/layout.tsx + app/dashboard/layout.tsx guard logikasi shu yerda.
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AnimatedLogo } from "@/components/animated-logo";
import { PushSideEffects } from "@/components/pv/push-side-effects";
import { ToastProvider } from "@/components/pv/toast";
import { VaqtdaSplash } from "@/components/vaqtda-splash";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { ProviderProvider } from "@/context/ProviderContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { isAuthenticated, user, loading } = useAuth();
  const { colors } = useTheme();
  const [introDone, setIntroDone] = useState(false);

  // Splash darhol yopiladi — uning o'rnida intro animatsiya o'ynaydi
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  const isProvider = isAuthenticated && user?.role === "provider";
  const isWorker = isAuthenticated && user?.role === "worker";
  const showOverlay = loading || !introDone;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <PushSideEffects />
      {!loading && (
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Protected guard={isProvider}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="stats" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="schedule" />
            <Stack.Screen name="services" />
            <Stack.Screen name="workers" />
            <Stack.Screen name="menu" />
            <Stack.Screen name="business-profile" />
            <Stack.Screen name="cards" />
            <Stack.Screen name="payment-settings" />
            <Stack.Screen name="chat/[id]" />
          </Stack.Protected>
          <Stack.Protected guard={isWorker}>
            <Stack.Screen name="(worker)" />
          </Stack.Protected>
          <Stack.Protected guard={!isProvider && !isWorker}>
            <Stack.Screen name="login" />
          </Stack.Protected>
        </Stack>
      )}

      {/* Kirish intro'si: brend splash bir marta o'ynaydi; agar auth hali
          yuklanayotgan bo'lsa, splash tugagach shimmer-loader kutib turadi */}
      {showOverlay &&
        (introDone ? (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: colors.background,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AnimatedLogo variant="loading" size={100} />
          </View>
        ) : (
          <VaqtdaSplash onDone={() => setIntroDone(true)} />
        ))}
    </View>
  );
}

function ThemedApp() {
  const { scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <RootNavigator />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <ProviderProvider>
                <ToastProvider>
                  <ThemedApp />
                </ToastProvider>
              </ProviderProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
