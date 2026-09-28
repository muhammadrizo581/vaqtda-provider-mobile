// Provayder kategoriyasining bron rejimi:
//   slots — oddiy soatlik xizmat (hozirgi standart holat)
//   table — restoran/klub: mijoz sana + vaqt + stol/kompyuter tanlaydi
//   daily — dacha/villa: mijoz kelish–ketish sanalarini tanlaydi (kunlik bron)
// unit — table rejimidagi birlik turi: "table" (stol) yoki "computer" (kompyuter klub).
//
// usesDepartments / usesStaff — xodimli bizneslar bayroqchalari:
//   usesDepartments — biznes ichida bo'limlar bor (Kardiologiya, Urologiya…)
//   usesStaff       — biznes ichida xodimlar bor (klinikada shifokor,
//                     sartaroshxonada usta — ikkalasi ham provider_staff)
// Ikkalasi ham kategoriya qatoridan olinadi; ustun hali qo'shilmagan bo'lsa — false.
// Yakka (individual) biznesda ikkalasi ham doim o'chiq.
//
// hasWorkers — usesStaff ning eski nomi (sartaroshxona konteksti). Mavjud
// kodlarni buzmaslik uchun alias sifatida qaytariladi.
import { useEffect, useState } from "react";
import { useProvider } from "@/context/ProviderContext";
import { getMemoryCache, readCache, writeCache, TTL_CONFIG } from "@/lib/offline-cache";
import { supabase } from "@/lib/supabase";

export type BookingMode = "slots" | "table" | "daily";
export type TableUnit = "table" | "computer";

// Kategoriyaning xom bayroqlari (individual niqobisiz — u qaytarishda qo'llanadi)
interface CategoryFlags {
  mode: BookingMode;
  unit: TableUnit;
  usesDepartments: boolean;
  usesStaff: boolean;
  categorySlug: string;
}

const DEFAULT_FLAGS: CategoryFlags = {
  mode: "slots",
  unit: "table",
  usesDepartments: false,
  usesStaff: false,
  categorySlug: "",
};

export function useBookingMode(): {
  mode: BookingMode;
  unit: TableUnit;
  usesDepartments: boolean;
  usesStaff: boolean;
  /** @deprecated usesStaff bilan bir xil — yangi kodda usesStaff ishlating */
  hasWorkers: boolean;
  isIndividual: boolean;
  categorySlug: string;
  loading: boolean;
} {
  const { provider } = useProvider();
  const categoryId = provider?.category_id;
  const cacheKey = categoryId ? `category.flags.${categoryId}` : "";

  // Qiymat qaysi kategoriya uchun yuklangani bilan saqlanadi — kategoriya
  // almashganda eskisi yangisi deb ko'rinib qolmasin
  const [loaded, setLoaded] = useState<{ key: string; flags: CategoryFlags } | null>(null);

  useEffect(() => {
    if (!cacheKey) return;
    let cancelled = false;

    // setTimeout — effekt ichida sinxron setState bo'lmasligi uchun
    const timer = setTimeout(async () => {
      const cached = await readCache<CategoryFlags>(cacheKey);
      if (cached && !cancelled) setLoaded({ key: cacheKey, flags: cached });

      try {
        const { data, error } = await supabase
          .from("categories")
          .select("*")
          .eq("id", categoryId)
          .maybeSingle();
        if (error) throw error;
        if (cancelled) return;

        const m = data?.booking_mode;
        const flags: CategoryFlags = {
          mode: m === "table" || m === "daily" ? m : "slots",
          unit: data?.table_unit === "computer" ? "computer" : "table",
          usesDepartments: data?.uses_departments === true,
          usesStaff: data?.uses_staff === true,
          categorySlug: data?.slug || "",
        };
        setLoaded({ key: cacheKey, flags });
        await writeCache(cacheKey, flags, TTL_CONFIG);
      } catch {
        // Tarmoq xatosi: kesh bo'lsa u qoladi, bo'lmasa standart rejim bilan
        // davom etamiz — ekranlar cheksiz yuklanishda qolib ketmasin
        if (!cancelled && !cached) setLoaded({ key: cacheKey, flags: DEFAULT_FLAGS });
      }
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cacheKey, categoryId]);

  // Kategoriya yo'q — standart; aks holda shu kategoriya uchun yuklangan qiymat
  // yoki RAM kesh (0ms). Ikkalasi ham bo'lmasa — hali yuklanmoqda.
  const flags = !cacheKey
    ? DEFAULT_FLAGS
    : loaded?.key === cacheKey
      ? loaded.flags
      : getMemoryCache<CategoryFlags>(cacheKey);

  const isIndividual = provider?.business_type === "individual";
  const usesStaff = !isIndividual && !!flags?.usesStaff;

  return {
    mode: flags?.mode ?? "slots",
    unit: flags?.unit ?? "table",
    usesDepartments: !isIndividual && !!flags?.usesDepartments,
    usesStaff,
    hasWorkers: usesStaff,
    isIndividual,
    categorySlug: flags?.categorySlug ?? "",
    loading: !flags,
  };
}
