// Push yon effektlari: kirgan provayder uchun token ro'yxati + push bosilganda
// tegishli ekranga yo'naltirish (bron -> Bronlar tabi, chat -> suhbat).
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { registerForPushNotifications } from "@/lib/push";

export function PushSideEffects() {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  const userId = user?.id;

  useEffect(() => {
    if (isAuthenticated && userId) registerForPushNotifications(userId);
  }, [isAuthenticated, userId]);

  useEffect(() => {
    const handle = (resp: Notifications.NotificationResponse) => {
      const data = resp.notification.request.content.data as {
        type?: string;
        conversation_id?: string;
      };
      if (data?.type === "chat_message" && data.conversation_id) {
        router.push(`/chat/${data.conversation_id}`);
      } else if (data?.type === "new_booking") {
        router.push("/appointments");
      }
    };

    // Sovuq start: ilova push bosilishi bilan ochilgan bo'lsa
    Notifications.getLastNotificationResponseAsync().then((resp) => {
      if (resp) handle(resp);
    });
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, [router]);

  return null;
}
