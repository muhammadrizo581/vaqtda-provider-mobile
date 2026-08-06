// Provayder hamyoni (wallet) — provider_wallet view'idan (tolov-hisob.sql).
// Hisob raqam + yig'ilgan summalar (naqd/online ajratilgan).
import { useCallback, useEffect, useState } from "react";
import { useProvider } from "@/context/ProviderContext";
import { supabase } from "@/lib/supabase";

export interface Wallet {
  account_number: string | null;
  earned_total: number;     // jami (naqd + online) — statistika
  online_collected: number; // platformada turgan online pul (keyin payout)
  cash_collected: number;   // provayder qo'lidagi naqd
  paid_count: number;
}

export function useWallet() {
  const { provider } = useProvider();
  const providerId = provider?.id;
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!providerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("provider_wallet")
      .select("account_number, earned_total, online_collected, cash_collected, paid_count")
      .eq("provider_id", providerId)
      .maybeSingle();
    setWallet(
      data
        ? {
            account_number: data.account_number ?? provider?.account_number ?? null,
            earned_total: Number(data.earned_total || 0),
            online_collected: Number(data.online_collected || 0),
            cash_collected: Number(data.cash_collected || 0),
            paid_count: Number(data.paid_count || 0),
          }
        : {
            // View hali yaratilmagan bo'lsa — hech bo'lmasa hisob raqamni ko'rsatamiz
            account_number: provider?.account_number ?? null,
            earned_total: 0,
            online_collected: 0,
            cash_collected: 0,
            paid_count: 0,
          }
    );
    setLoading(false);
  }, [providerId, provider?.account_number]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  return { wallet, loading, reload: load };
}
