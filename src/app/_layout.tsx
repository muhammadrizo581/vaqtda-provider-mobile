// Ildiz layout: kontekst provayderlar + auth guard + kirish intro animatsiyasi.
// Saytdagi app/layout.tsx + app/dashboard/layout.tsx guard logikasi shu yerda.
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AnimatedLogo } from "@/components/animated-logo";
import { ToastProvider } from "@/components/pv/toast";
import { VaqtdaSplash } from "@/components/vaqtda-splash";
import { colors } from "@/constants/colors";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { ProviderProvider } from "@/context/ProviderContext";

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { isAuthenticated, user, loading } = useAuth();
  const [introDone, setIntroDone] = useState(false);

  // Splash darhol yopiladi — uning o'rnida intro animatsiya o'ynaydi
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  const isProvider = isAuthenticated && user?.role === "provider";
  const showOverlay = loading || !introDone;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
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
            <Stack.Screen name="menu" />
            <Stack.Screen name="business-profile" />
            <Stack.Screen name="chat/[id]" />
          </Stack.Protected>
          <Stack.Protected guard={!isProvider}>
            <Stack.Screen name="login" />
          </Stack.Protected>
        </Stack>
      )}

      {/* Kirish intro'si: brend splash bir marta o'ynaydi; agar auth hali
          yuklanayotgan bo'lsa, splash tugagach shimmer-loader kutib turadi */}
      {showOverlay &&
        (introDone ? (
          <View style={styles.introOverlay}>
            <AnimatedLogo variant="loading" size={100} />
          </View>
        ) : (
          <VaqtdaSplash onDone={() => setIntroDone(true)} />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  introOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <ProviderProvider>
            <ToastProvider>
              <StatusBar style="light" />
              <RootNavigator />
            </ToastProvider>
          </ProviderProvider>
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
