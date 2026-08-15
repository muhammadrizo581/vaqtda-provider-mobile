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
import { supabase } from "@/lib/supabase";

export type BookingMode = "slots" | "table" | "daily";
export type TableUnit = "table" | "computer";

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
  const [mode, setMode] = useState<BookingMode>("slots");
  const [unit, setUnit] = useState<TableUnit>("table");
  const [usesDepartments, setUsesDepartments] = useState(false);
  const [usesStaff, setUsesStaff] = useState(false);
  const [loading, setLoading] = useState(!!categoryId);

  useEffect(() => {
    if (!categoryId) return;
    let cancelled = false;
    // setTimeout — effekt ichida sinxron setState bo'lmasligi uchun
    const timer = setTimeout(async () => {
      setLoading(true);
      // select("*") — table_unit / uses_departments / uses_staff ustunlari hali
      // qo'shilmagan bo'lsa ham xato bermaydi
      const { data } = await supabase
        .from("categories")
        .select("*")
        .eq("id", categoryId)
        .maybeSingle();
      if (cancelled) return;
      const m = data?.booking_mode;
      setMode(m === "table" || m === "daily" ? m : "slots");
      setUnit(data?.table_unit === "computer" ? "computer" : "table");
      setUsesDepartments(data?.uses_departments === true);
      // Bazada bayroq nomi — categories.uses_staff (usta/shifokor ishlatiladimi)
      setUsesStaff(data?.uses_staff === true);
      setLoading(false);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [categoryId]);

  return { mode, unit, usesDepartments, usesStaff, hasWorkers: usesStaff, loading };
}