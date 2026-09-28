// Foydalanuvchi kontenti moderatsiyasi (App Store Guideline 1.2) — provayder tomoni:
// nomaqbul matn filtri, mijoz xabari ustidan shikoyat va mijozni bloklash.
// Bloklangan mijoz shu biznesga chatda yoza olmaydi (DB: chat_is_blocked).
// Shikoyatlar DB triggeri orqali admin Telegram guruhiga darhol boradi.
import { useEffect, useSyncExternalStore } from "react";
import { Alert } from "react-native";
import { supabase } from "@/lib/supabase";
import type { TKey } from "@/locales/uz";

// Oddiy so'zlarda uchramaydigan haqoratli ildizlar (ru / uz / en)
const BAD_STEMS = [
  "хуй", "хуе", "пизд", "ебат", "ебан", "еблан", "бляд", "блять", "мудак", "мудил",
  "пидор", "пидар", "залуп", "шлюх", "гандон",
  "jalab", "qanjiq", "ko'tak", "qo'toq", "qotoq", "dalbayob", "dolbayob", "gandon",
  "fuck", "bitch", "cunt", "nigger", "faggot", "asshole",
];

export function containsProfanity(text: string): boolean {
  const s = text.toLowerCase().replace(/ё/g, "е").replace(/[ʻʼ‘’`]/g, "'");
  return BAD_STEMS.some((w) => s.includes(w));
}

export type ReportReason = "offensive" | "spam";

export function pickReportReason(t: (key: TKey) => string, onPick: (reason: ReportReason) => void) {
  Alert.alert(t("mod.reason_title"), undefined, [
    { text: t("mod.reason_offensive"), onPress: () => onPick("offensive") },
    { text: t("mod.reason_spam"), onPress: () => onPick("spam") },
    { text: t("common.cancel"), style: "cancel" },
  ]);
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) throw new Error("not_authenticated");
  return uid;
}

// ── Bloklangan mijozlar: chat ro'yxati va suhbat bir xil holatni ko'rishi uchun ──
let blockedClients = new Set<string>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function loadBlockedClients() {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) return;
  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocked_user_id")
    .eq("blocker_id", uid)
    .not("blocked_user_id", "is", null);
  if (error) return;
  const rows = (data ?? []) as { blocked_user_id: string | null }[];
  blockedClients = new Set(rows.map((r) => r.blocked_user_id).filter((x): x is string => !!x));
  emit();
}

export function useBlockedClients() {
  const snap = useSyncExternalStore(subscribe, () => blockedClients, () => blockedClients);
  useEffect(() => {
    loadBlockedClients();
  }, []);
  return snap;
}

export async function blockClient(clientId: string) {
  const uid = await currentUserId();
  const { error } = await supabase.from("user_blocks").insert({ blocker_id: uid, blocked_user_id: clientId });
  if (error && error.code !== "23505") throw error;
  blockedClients = new Set(blockedClients).add(clientId);
  emit();
}

export async function unblockClient(clientId: string) {
  const uid = await currentUserId();
  const { error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", uid)
    .eq("blocked_user_id", clientId);
  if (error) throw error;
  const next = new Set(blockedClients);
  next.delete(clientId);
  blockedClients = next;
  emit();
}

export async function reportChat(conversationId: string, messageId: string | null, reason: ReportReason) {
  const uid = await currentUserId();
  const { error } = await supabase
    .from("chat_reports")
    .insert({ reporter_id: uid, conversation_id: conversationId, message_id: messageId, reason });
  if (error) throw error;
}
