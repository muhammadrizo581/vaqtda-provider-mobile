// Tarif sotib olish oqimi: buyurtma (server) → Click/Payme checkout → to'lovni kuzatish.
//
// Buyurtmani subscription-checkout Edge Function yaratadi (narx serverda). To'lovni
// click/payme webhook'lari tasdiqlaydi, bazadagi trigger (process_subscription_payment)
// provayder tarifini faollashtiradi — bu hook shuni kutib, profilni yangilaydi.
// Bu jadvallarda realtime yoqilmagan, shuning uchun polling + ilovaga qaytganda tekshiruv.
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking } from "react-native";
import { useProvider } from "@/context/ProviderContext";
import { supabase } from "@/lib/supabase";
import { buildClickCheckoutUrl } from "@/utils/click";
import { buildPaymeCheckoutUrl } from "@/utils/payme";
import type { BillingCycle, PlanCode } from "@/utils/plan";

export type PayMethod = "click" | "payme";

export interface SubscriptionPayment {
  id: string;
  plan_code: string;
  amount: number;
  payment_method: string;
  status: "pending" | "completed" | "failed" | string;
  period_months: number | null;
  created_at: string;
}

interface PendingCheckout {
  orderId: string;
  subPaymentId: string;
  plan: PlanCode;
  method: PayMethod;
  url: string;
}

const POLL_MS = 3000;
const POLL_LIMIT = 200; // ~10 daqiqa — undan keyin ilovaga qaytganda tekshiriladi

export function useSubscriptionCheckout({ onPaid }: { onPaid?: (plan: PlanCode) => void } = {}) {
  const { provider, reload: reloadProvider } = useProvider();
  const providerId = provider?.id;

  const [history, setHistory] = useState<SubscriptionPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<PayMethod | null>(null);
  const [pending, setPending] = useState<PendingCheckout | null>(null);

  const onPaidRef = useRef(onPaid);
  useEffect(() => {
    onPaidRef.current = onPaid;
  }, [onPaid]);

  const loadHistory = useCallback(async () => {
    if (!providerId) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("subscription_payments")
      .select("id, plan_code, amount, payment_method, status, period_months, created_at")
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory((data as SubscriptionPayment[]) || []);
    setLoading(false);
  }, [providerId]);

  // setTimeout — effekt ichida sinxron setState bo'lmasligi uchun
  useEffect(() => {
    const timer = setTimeout(loadHistory, 0);
    return () => clearTimeout(timer);
  }, [loadHistory]);

  /** Buyurtma yaratib, to'lov sahifasini ochadi. Muvaffaqiyatsiz bo'lsa false. */
  const start = useCallback(
    async (plan: PlanCode, cycle: BillingCycle, method: PayMethod): Promise<boolean> => {
      if (!providerId || starting) return false;
      setStarting(method);
      try {
        const { data, error } = await supabase.functions.invoke("subscription-checkout", {
          body: { plan, cycle, method },
        });
        const res = data as { ok?: boolean; order_id?: string; sub_payment_id?: string; amount?: number } | null;
        if (error || !res?.ok || !res.order_id || !res.sub_payment_id || !res.amount) return false;

        const url =
          method === "click"
            ? buildClickCheckoutUrl(res.order_id, res.amount)
            : buildPaymeCheckoutUrl(res.order_id, res.amount);
        setPending({ orderId: res.order_id, subPaymentId: res.sub_payment_id, plan, method, url });
        loadHistory();
        // Ochilmasa ham kutish paneli qoladi — "To'lov sahifasini ochish" bilan qayta uriniladi
        Linking.openURL(url).catch(() => {});
        return true;
      } catch {
        return false;
      } finally {
        setStarting(null);
      }
    },
    [providerId, starting, loadHistory]
  );

  // To'lov tushishini kutish
  useEffect(() => {
    if (!pending) return;
    let stopped = false;
    let tries = 0;

    const check = async () => {
      if (stopped) return;
      tries += 1;
      const [{ data: payment }, { data: order }] = await Promise.all([
        supabase.from("subscription_payments").select("status").eq("id", pending.subPaymentId).maybeSingle(),
        supabase.from("bookings").select("payment_status").eq("id", pending.orderId).maybeSingle(),
      ]);
      if (stopped) return;
      if (payment?.status === "completed" || order?.payment_status === "paid") {
        stopped = true;
        setPending(null);
        await reloadProvider();
        loadHistory();
        onPaidRef.current?.(pending.plan);
      } else if (tries >= POLL_LIMIT) {
        stopped = true;
      }
    };

    const timer = setInterval(check, POLL_MS);
    check();
    // Click/Payme ilovasidan qaytganda darhol tekshiramiz
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        tries = 0;
        stopped = false;
        check();
      }
    });
    return () => {
      stopped = true;
      clearInterval(timer);
      sub.remove();
    };
  }, [pending, reloadProvider, loadHistory]);

  const reopen = useCallback(() => {
    if (pending) Linking.openURL(pending.url).catch(() => {});
  }, [pending]);

  const cancel = useCallback(() => setPending(null), []);

  return { history, loading, starting, pending, start, reopen, cancel, reload: loadHistory };
}
