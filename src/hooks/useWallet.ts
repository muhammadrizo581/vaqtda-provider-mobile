import { useCallback, useEffect, useState } from "react";
import { useProvider } from "@/context/ProviderContext";
import { getMemoryCache, readCache, writeCache, TTL_WALLET } from "@/lib/offline-cache";
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
  const cacheKey = providerId ? `wallet.${providerId}` : "";

  // 1. RAM xotiradan sinxron o'qish (0ms instant)
  const initialCache = cacheKey ? getMemoryCache<Wallet>(cacheKey) : null;

  const [wallet, setWallet] = useState<Wallet | null>(initialCache);
  const [loading, setLoading] = useState<boolean>(!initialCache);

  const load = useCallback(async () => {
    if (!providerId) {
      setLoading(false);
      return;
    }

    // Disk keshni tekshirish
    const cached = await readCache<Wallet>(cacheKey);
    if (cached) {
      setWallet(cached);
      setLoading(false);
    }

    try {
      const { data } = await supabase
        .from("provider_wallet")
        .select("account_number, earned_total, online_collected, cash_collected, paid_count")
        .eq("provider_id", providerId)
        .maybeSingle();

      const fresh: Wallet = data
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
          };

      setWallet(fresh);
      await writeCache(cacheKey, fresh, TTL_WALLET);
    } catch {
      // Tarmoq xatosi bo'lsa kesh saqlanadi
    } finally {
      setLoading(false);
    }
  }, [providerId, provider, cacheKey]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  return { wallet, loading, reload: load };
}
