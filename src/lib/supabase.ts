import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

// Ochiq (publishable) kalitlar — saytdagi NEXT_PUBLIC_* bilan bir xil.
const SUPABASE_URL = "https://ujpitkwdmbgjfqjcohxf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_PQMtwUbuLKNLqWbGM8E1dQ_SOvqnrwc";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
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
