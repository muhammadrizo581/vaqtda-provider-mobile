// Tarif (PLUS/PRO) sotib olish so'rovi — hozircha to'lov tizimi yo'q, shuning
// uchun "sotib olish" bosilganda plan_requests'ga yoziladi va Telegram'ga
// (mavjud "contact" edge function orqali) admin'ga xabar boradi. Tarifni
// yoqish hali qo'lda (admin Supabase'da providers'ni yangilaydi).
import { useCallback, useEffect, useMemo, useState } from "react";
import { useProvider } from "@/context/ProviderContext";
import { localize } from "@/utils/localize";
import { supabase } from "@/lib/supabase";

export interface PlanRequest {
  id: string;
  requested_plan: "plus" | "pro";
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
}

export function usePlanRequest() {
  const { provider } = useProvider();
  const providerId = provider?.id;

  const [history, setHistory] = useState<PlanRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!providerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("plan_requests")
      .select("id, requested_plan, status, created_at, reviewed_at")
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory((data as PlanRequest[]) || []);
    setLoading(false);
  }, [providerId]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const pending = useMemo(() => history.find((h) => h.status === "pending") || null, [history]);

  const requestPlan = useCallback(
    async (plan: "plus" | "pro") => {
      if (!providerId || sending || pending) return false;
      setSending(true);
      const { data, error } = await supabase
        .from("plan_requests")
        .insert({ provider_id: providerId, requested_plan: plan })
        .select("id, requested_plan, status, created_at, reviewed_at")
        .single();
      if (!error && data) {
        setHistory((prev) => [data as PlanRequest, ...prev]);
        const name = localize(provider?.business_name) || provider?.slug || "Provayder";
        supabase.functions
          .invoke("contact", {
            body: {
              name,
              phone: provider?.phone_number || "",
              message: `💳 Tarif so'rovi: ${plan.toUpperCase()} — provayder "${name}" shu tarifni sotib olmoqchi.`,
            },
          })
          .catch(() => {});
      }
      setSending(false);
      return !error;
    },
    [providerId, sending, pending, provider]
  );

  return { history, pending, loading, sending, requestPlan, reload: load };
}
