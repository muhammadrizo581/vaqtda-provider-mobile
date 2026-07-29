import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

// Ochiq (publishable) kalitlar — saytdagi NEXT_PUBLIC_* bilan bir xil.
const SUPABASE_URL = "https://ujpitkwdmbgjfqjcohxf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_PQMtwUbuLKNLqWbGM8E1dQ_SOvqnrwc";

// Expo Router web output runs this module on the Node SSR renderer too, where
// `window` doesn't exist — AsyncStorage's web impl touches window.localStorage
// and crashes the server bundle if used there.
const isServerRenderer = Platform.OS === "web" && typeof window === "undefined";

const noopStorage = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: isServerRenderer ? noopStorage : AsyncStorage,
    autoRefreshToken: !isServerRenderer,
    persistSession: !isServerRenderer,
    detectSessionInUrl: false,
  },
});

// Ilova faol bo'lganda token yangilanishini yoqamiz (Supabase RN tavsiyasi)
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
