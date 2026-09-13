import { useCallback, useEffect, useState } from "react";
import { useProvider } from "@/context/ProviderContext";
import { getMemoryCache, readCache, writeCache, TTL_DYNAMIC } from "@/lib/offline-cache";
import { supabase } from "@/lib/supabase";

export interface WaitlistClient {
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
}

export interface WaitlistEntry {
  id: string;
  client_id: string;
  desired_date: string; // YYYY-MM-DD
  date_to: string | null; // flexible oraliq oxiri
  time_from: string | null;
  time_to: string | null;
  duration_minutes: number | null;
  note: any; // jsonb {uz,ru,en} yoki matn
  flexible: boolean;
  status: "waiting" | "notified" | "converted" | "cancelled" | "expired" | string;
  notified_at: string | null;
  created_at: string;
  client: WaitlistClient | null;
}

export function useWaitlistEntries() {
  const { provider } = useProvider();
  const providerId = provider?.id;
  const cacheKey = providerId ? `waitlist.${providerId}` : "";

  // 1. RAM xotiradan sinxron o'qish (0ms instant)
  const initialCache = cacheKey ? getMemoryCache<WaitlistEntry[]>(cacheKey) : null;

  const [entries, setEntries] = useState<WaitlistEntry[]>(initialCache ?? []);
  const [loading, setLoading] = useState<boolean>(!initialCache);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!providerId) {
      setLoading(false);
      return;
    }

    // Disk keshni tezkor tekshirish
    const cached = await readCache<WaitlistEntry[]>(cacheKey);
    if (cached && cached.length > 0) {
      setEntries(cached);
      setLoading(false);
    }

    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("waitlist")
        .select(
          "id, client_id, desired_date, date_to, time_from, time_to, duration_minutes, note, flexible, status, notified_at, created_at"
        )
        .eq("provider_id", providerId)
        .order("created_at", { ascending: false });
      if (err) throw err;

      const clientIds = [...new Set((data || []).map((e: any) => e.client_id))];
      let profiles: Record<string, WaitlistClient> = {};
      if (clientIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, phone, avatar_url")
          .in("id", clientIds);
        profiles = Object.fromEntries((profs || []).map((p: any) => [p.id, p]));
      }

      const fresh: WaitlistEntry[] = (data || []).map((e: any) => ({
        ...e,
        client: profiles[e.client_id] || null,
      }));

      setEntries(fresh);
      await writeCache(cacheKey, fresh, TTL_DYNAMIC);
    } catch {
      if (!cached) setError("load_failed");
    } finally {
      setLoading(false);
    }
  }, [providerId, cacheKey]);

  const notify = useCallback(
    async (id: string) => {
      const now = new Date().toISOString();
      const { error: err } = await supabase
        .from("waitlist")
        .update({
          status: "notified",
          notified_at: now,
        })
        .eq("id", id);
      if (!err) {
        setEntries((prev) => {
          const updated = prev.map((e) =>
            e.id === id ? { ...e, status: "notified", notified_at: now } : e
          );
          if (providerId) writeCache(`waitlist.${providerId}`, updated, TTL_DYNAMIC).catch(() => {});
          return updated;
        });
        return true;
      }
      return false;
    },
    [providerId]
  );

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  return { entries, loading, error, reload: load, notify };
}
