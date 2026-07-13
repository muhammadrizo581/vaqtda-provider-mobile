// Provayderning barcha suhbatlaridagi o'qilmagan xabarlar yig'indisi.
// chat_conversations o'zgarishlariga realtime obuna bo'lib yangilanadi.
import { useCallback, useEffect, useState } from "react";
import { useProvider } from "@/context/ProviderContext";
import { supabase } from "@/lib/supabase";

export function useChatUnread(): number {
  const { provider } = useProvider();
  const providerId = provider?.id || null;
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (!providerId) return;
    const { data } = await supabase
      .from("chat_conversations")
      .select("provider_unread")
      .eq("provider_id", providerId);
    setUnread(
      ((data as { provider_unread: number }[]) || []).reduce(
        (sum, c) => sum + (c.provider_unread || 0),
        0
      )
    );
  }, [providerId]);

  useEffect(() => {
    if (!providerId) return;
    // setTimeout — effekt ichida sinxron setState bo'lmasligi uchun
    const timer = setTimeout(refresh, 0);
    // Kanal nomi har mount uchun unikal — singleton klientda bir xil topic
    // qayta ishlatilsa "cannot add callbacks after subscribe()" xatosi beradi
    const channel = supabase
      .channel(`chat-unread-${providerId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_conversations", filter: `provider_id=eq.${providerId}` },
        () => refresh()
      )
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [providerId, refresh]);

  return unread;
}
