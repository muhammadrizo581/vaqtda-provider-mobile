// Push yon effektlari: kirgan provayder uchun token ro'yxati + push bosilganda
// tegishli ekranga yo'naltirish (bron -> Bronlar tabi, chat -> suhbat).
//
// Sovuq startda push javobi auth yuklanib, navigator mount bo'lishidan OLDIN
// keladi — o'shanda router.push xato beradi. Shu sabab javob kutib turiladi va
// sessiya tayyor bo'lgach bajariladi.
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { getNotifications, registerForPushNotifications } from "@/lib/push";

type PushData = { type?: string; conversation_id?: string };

export function PushSideEffects() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const userId = user?.id;
  const ready = isAuthenticated && !loading;
  const readyRef = useRef(false);
  const pending = useRef<PushData | null>(null);

  useEffect(() => {
    if (isAuthenticated && userId) registerForPushNotifications(userId);
  }, [isAuthenticated, userId]);

  const openTarget = useCallback(
    (data: PushData) => {
      if (data.type === "chat_message" && data.conversation_id) {
        router.push(`/chat/${data.conversation_id}`);
      } else if (data.type === "new_booking") {
        router.push("/appointments");
      }
    },
    [router]
  );

  // Sessiya tayyor bo'lgach kutib turgan push'ni ochamiz
  useEffect(() => {
    readyRef.current = ready;
    if (!ready || !pending.current) return;
    const data = pending.current;
    pending.current = null;
    // Navigator shu commit'da mount bo'ladi — keyingi tick'da o'tamiz
    const timer = setTimeout(() => openTarget(data), 0);
    return () => clearTimeout(timer);
  }, [ready, openTarget]);

  useEffect(() => {
    const Notifications = getNotifications();
    if (!Notifications) return;

    const handle = (resp: any) => {
      const data = resp?.notification?.request?.content?.data as PushData | undefined;
      if (!data) return;
      if (readyRef.current) openTarget(data);
      else pending.current = data;
    };

    // Sovuq start: ilova push bosilishi bilan ochilgan bo'lsa
    Notifications.getLastNotificationResponseAsync?.().then((resp: any) => {
      if (resp) handle(resp);
    });
    const sub = Notifications.addNotificationResponseReceivedListener?.(handle);
    return () => sub?.remove?.();
  }, [openTarget]);

  return null;
}
