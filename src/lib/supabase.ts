import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import { invalidateCache, readCache, writeCache } from "@/lib/offline-cache";

// Ochiq (publishable) kalitlar — saytdagi NEXT_PUBLIC_* bilan bir xil.
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || "https://ujpitkwdmbgjfqjcohxf.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_PQMtwUbuLKNLqWbGM8E1dQ_SOvqnrwc";

// Expo Router web output runs this module on the Node SSR renderer too, where
// `window` doesn't exist — AsyncStorage's web impl touches window.localStorage
// and crashes the server bundle if used there.
const isServerRenderer = Platform.OS === "web" && typeof window === "undefined";

const noopStorage = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};

const nativeFetch = globalThis.fetch.bind(globalThis);

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

// Supabase REST o'qishlarini umumiy offline cache bilan o'raymiz. Authorization
// header hash'i cache key'ga kiradi, shuning uchun bir account ma'lumoti boshqa
// accountga ko'rsatilmaydi. POST/PATCH/DELETE bajarilganda esa REST keshi tozalanadi.
async function cachedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = input instanceof Request ? input : null;
  const url = typeof input === "string" ? input : request?.url || input.toString();
  const method = (init?.method || request?.method || "GET").toUpperCase();
  const headers = new Headers(init?.headers || request?.headers);
  const isRestRead = method === "GET" && url.includes("/rest/v1/");

  if (!isRestRead || isServerRenderer) {
    const response = await nativeFetch(input, init);
    // Ma'lumot o'zgarganda (POST, PATCH, DELETE) eski REST keshlarni tozalaymiz
    if (response.ok && ["POST", "PATCH", "DELETE", "PUT"].includes(method) && url.includes("/rest/v1/")) {
      invalidateCache("rest.").catch(() => {});
    }
    return response;
  }

  const cacheKey = `rest.${stableHash(`${url}|${headers.get("authorization") || "anon"}`)}`;
  try {
    const response = await nativeFetch(input, init);
    if (response.ok) {
      // Disk va RAM yozish javobni kutib turmasligi uchun async fon rejimida saqlanadi
      response
        .clone()
        .text()
        .then((body) => writeCache(cacheKey, body))
        .catch(() => {});
    }
    return response;
  } catch (error) {
    const cachedBody = await readCache<string>(cacheKey);
    if (cachedBody == null) throw error;
    return new Response(cachedBody, {
      status: 200,
      headers: { "content-type": "application/json", "x-vaqtda-cache": "offline" },
    });
  }
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: isServerRenderer ? noopStorage : AsyncStorage,
    autoRefreshToken: !isServerRenderer,
    persistSession: !isServerRenderer,
    detectSessionInUrl: false,
  },
  global: { fetch: cachedFetch },
});

// Ilova faol bo'lganda token yangilanishini yoqamiz (Supabase RN tavsiyasi)
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
