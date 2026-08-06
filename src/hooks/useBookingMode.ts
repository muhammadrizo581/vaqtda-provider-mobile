// Provayder kategoriyasining bron rejimi:
//   slots — oddiy soatlik xizmat (hozirgi standart holat)
//   table — restoran/klub: mijoz sana + vaqt + stol/kompyuter tanlaydi
//   daily — dacha/villa: mijoz kelish–ketish sanalarini tanlaydi (kunlik bron)
// unit — table rejimidagi birlik turi: "table" (stol) yoki "computer" (kompyuter klub).
//
// usesDepartments / usesStaff — shifoxona (klinika) rejimi bayroqchalari:
//   usesDepartments — biznes ichida bo'limlar bor (Kardiologiya, Urologiya…)
//   usesStaff       — biznes ichida shifokorlar (xodimlar) bor
// Ikkalasi ham kategoriya qatoridan olinadi; ustun hali qo'shilmagan bo'lsa — false.
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
      setUsesStaff(data?.uses_staff === true);
      setLoading(false);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [categoryId]);

  return { mode, unit, usesDepartments, usesStaff, loading };
}
