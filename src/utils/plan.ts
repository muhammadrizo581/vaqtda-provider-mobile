// Tarif (subscription) holati yordamchilari — plan.tsx, business-profile.tsx va
// settings.tsx dagi tarif bannerlari shu yerdan foydalanadi.
//
// Bazadagi ustunlar (providers): subscription_status ('trial' | 'active' | 'expired'),
// plan_code ('plus' | 'pro'), trial_ends_at, subscription_ends_at.
// Muddat tugashini hech qanday cron 'expired' ga o'tkazmaydi — shu sabab sanadan hisoblanadi.
import type { ProviderProfile } from "@/hooks/useProviderProfile";
import type { TKey } from "@/locales/uz";

type TFunc = (key: TKey, vars?: Record<string, string | number>) => string;

export type PlanCode = "plus" | "pro";
export type BillingCycle = "monthly" | "yearly";

// Narxlar (so'm). Serverdagi supabase/functions/subscription-checkout PRICES bilan bir xil
// bo'lishi shart — to'lov summasini aynan server belgilaydi, bu yerda faqat ko'rsatiladi.
export const PLAN_PRICES: Record<PlanCode, Record<BillingCycle, number>> = {
  plus: { monthly: 25000, yearly: 240000 },
  pro: { monthly: 50000, yearly: 480000 },
};

// Sinov (trial) muddati — yangi provayderga 60 kun bepul PRO
export const TRIAL_DAYS = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

/** ISO sanagacha qolgan to'liq kunlar (o'tib ketgan bo'lsa 0) */
export function daysLeft(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / DAY_MS));
}

export interface SubscriptionState {
  /** Amaldagi tarif (sinovda — PRO) */
  plan: PlanCode;
  isTrial: boolean;
  isActive: boolean;
  isExpired: boolean;
  daysLeft: number;
  /** Sinov yoki obuna tugash sanasi; faol obunada muddat bo'lmasa null */
  endsAt: string | null;
}

export function getSubscription(provider: ProviderProfile | null): SubscriptionState {
  const plan: PlanCode = (provider?.plan_code || "pro").toLowerCase() === "plus" ? "plus" : "pro";
  const status = provider?.subscription_status || "trial";

  if (status === "trial") {
    const endsAt = provider?.trial_ends_at ?? null;
    const left = endsAt ? daysLeft(endsAt) : TRIAL_DAYS;
    return left > 0
      ? { plan: "pro", isTrial: true, isActive: false, isExpired: false, daysLeft: left, endsAt }
      : { plan, isTrial: false, isActive: false, isExpired: true, daysLeft: 0, endsAt };
  }

  if (status === "active") {
    const endsAt = provider?.subscription_ends_at ?? null;
    const left = endsAt ? daysLeft(endsAt) : 0;
    const expired = !!endsAt && left <= 0;
    return { plan, isTrial: false, isActive: !expired, isExpired: expired, daysLeft: left, endsAt };
  }

  return {
    plan,
    isTrial: false,
    isActive: false,
    isExpired: true,
    daysLeft: 0,
    endsAt: provider?.subscription_ends_at ?? null,
  };
}

/** Banner ostidagi qisqa matn: sinov / faol muddati qancha qolgani */
export function planStatusSubtitle(provider: ProviderProfile | null, t: TFunc): string {
  const sub = getSubscription(provider);
  if (sub.isTrial) return t("plan.trial_days_left", { days: sub.daysLeft });
  if (sub.isExpired) return t("plan.status_expired");
  return sub.endsAt ? t("plan.active_days_left", { days: sub.daysLeft }) : t("pv.more_plan_sub");
}
