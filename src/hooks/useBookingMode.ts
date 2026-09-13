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
//
// hasWorkers — usesStaff ning eski nomi (sartaroshxona konteksti). Mavjud
// kodlarni buzmaslik uchun alias sifatida qaytariladi.
import { useEffect, useState } from "react";
import { useProvider } from "@/context/ProviderContext";
import { getMemoryCache, readCache, writeCache, TTL_CONFIG } from "@/lib/offline-cache";
import { supabase } from "@/lib/supabase";

export type BookingMode = "slots" | "table" | "daily";
export type TableUnit = "table" | "computer";

interface BookingModeCache {
  mode: BookingMode;
  unit: TableUnit;
  usesDepartments: boolean;
  usesStaff: boolean;
}

export function useBookingMode(): {
  mode: BookingMode;
  unit: TableUnit;
  usesDepartments: boolean;
  usesStaff: boolean;
  /** @deprecated usesStaff bilan bir xil — yangi kodda usesStaff ishlating */
  hasWorkers: boolean;
  loading: boolean;
} {
  const { provider } = useProvider();
  const categoryId = provider?.category_id;
  const cacheKey = categoryId ? `category.mode.${categoryId}` : "";

  // 1. RAM xotiradan sinxron o'qish (0ms instant)
  const initialCache = cacheKey ? getMemoryCache<BookingModeCache>(cacheKey) : null;

  const [mode, setMode] = useState<BookingMode>(initialCache?.mode ?? "slots");
  const [unit, setUnit] = useState<TableUnit>(initialCache?.unit ?? "table");
  const [usesDepartments, setUsesDepartments] = useState<boolean>(initialCache?.usesDepartments ?? false);
  const [usesStaff, setUsesStaff] = useState<boolean>(initialCache?.usesStaff ?? false);
  const [loading, setLoading] = useState<boolean>(!initialCache && !!categoryId);

  useEffect(() => {
    if (!categoryId) return;
    let cancelled = false;

    const timer = setTimeout(async () => {
      // Disk keshni tezkor tekshiramiz
      const cached = await readCache<BookingModeCache>(cacheKey);
      if (cached && !cancelled) {
        setMode(cached.mode);
        setUnit(cached.unit);
        setUsesDepartments(cached.usesDepartments);
        setUsesStaff(cached.usesStaff);
        setLoading(false);
      }

      // Supabase'dan yangilash (fon rejimida)
      try {
        const { data } = await supabase
          .from("categories")
          .select("*")
          .eq("id", categoryId)
          .maybeSingle();

        if (cancelled) return;

        const m = data?.booking_mode;
        const freshMode: BookingMode = m === "table" || m === "daily" ? m : "slots";
        const freshUnit: TableUnit = data?.table_unit === "computer" ? "computer" : "table";
        const freshDepts = data?.uses_departments === true;
        const freshStaff = data?.uses_staff === true;

        setMode(freshMode);
        setUnit(freshUnit);
        setUsesDepartments(freshDepts);
        setUsesStaff(freshStaff);

        const record: BookingModeCache = {
          mode: freshMode,
          unit: freshUnit,
          usesDepartments: freshDepts,
          usesStaff: freshStaff,
        };
        await writeCache(cacheKey, record, TTL_CONFIG);
      } catch {
        // Tarmoq xatosi bo'lsa kesh yetarli
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [categoryId, cacheKey]);

  return { mode, unit, usesDepartments, usesStaff, hasWorkers: usesStaff, loading };
}