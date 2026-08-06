// Provayder kategoriyasining bron rejimi:
//   slots — oddiy soatlik xizmat (hozirgi standart holat)
//   table — restoran/klub: mijoz sana + vaqt + stol/kompyuter tanlaydi
//   daily — dacha/villa: mijoz kelish–ketish sanalarini tanlaydi (kunlik bron)
// unit — table rejimidagi birlik turi: "table" (stol) yoki "computer" (kompyuter klub).
import { useEffect, useState } from "react";
import { useProvider } from "@/context/ProviderContext";
import { supabase } from "@/lib/supabase";

export type BookingMode = "slots" | "table" | "daily";
export type TableUnit = "table" | "computer";

// hasWorkers — kategoriyada ustalar (workerlar) bo'ladimi (hozircha sartaroshxona).
export function useBookingMode(): {
  mode: BookingMode;
  unit: TableUnit;
  hasWorkers: boolean;
  loading: boolean;
} {
  const { provider } = useProvider();
  const categoryId = provider?.category_id;
  const [mode, setMode] = useState<BookingMode>("slots");
  const [unit, setUnit] = useState<TableUnit>("table");
  const [hasWorkers, setHasWorkers] = useState(false);
  const [loading, setLoading] = useState(!!categoryId);

  useEffect(() => {
    if (!categoryId) return;
    let cancelled = false;
    // setTimeout — effekt ichida sinxron setState bo'lmasligi uchun
    const timer = setTimeout(async () => {
      setLoading(true);
      // select("*") — table_unit/uses_staff ustunlari bo'lmasa ham xato bermaydi
      const { data } = await supabase
        .from("categories")
        .select("*")
        .eq("id", categoryId)
        .maybeSingle();
      if (cancelled) return;
      const m = data?.booking_mode;
      setMode(m === "table" || m === "daily" ? m : "slots");
      setUnit(data?.table_unit === "computer" ? "computer" : "table");
      // Bazada bayroq nomi — categories.uses_staff (usta/xodim ishlatiladimi)
      setHasWorkers(data?.uses_staff === true);
      setLoading(false);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [categoryId]);

  return { mode, unit, hasWorkers, loading };
}
