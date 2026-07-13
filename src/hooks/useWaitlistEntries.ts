// Provayderning navbat (waitlist) yozuvlari — to'g'ridan-to'g'ri Supabase'dan.
import { useCallback, useEffect, useState } from "react";
import { useProvider } from "@/context/ProviderContext";
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
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!providerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
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

      setEntries(
        (data || []).map((e: any) => ({
          ...e,
          client: profiles[e.client_id] || null,
        }))
      );
    } catch {
      setError("load_failed");
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  // setTimeout — effekt ichida sinxron setState bo'lmasligi uchun
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  return { entries, loading, error, reload: load };
}
