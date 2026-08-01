"use client";

// Chat — suhbatlar ro'yxati (provayder tomoni).
// Mijoz client-ilovadan yozadi; suhbatlar shu yerda last_message_at DESC ko'rinadi.
import { useRouter, type Href } from "expo-router";
import { MessageCircle } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BusinessGate } from "@/components/pv/business-gate";
import { Screen } from "@/components/pv/screen";
import { Card, ClientAvatar, EmptyState, PageHeader, Spinner } from "@/components/pv/ui";
import { useLanguage } from "@/context/LanguageContext";
import { makeThemedStyles, useColors } from "@/context/ThemeContext";
import { useProvider } from "@/context/ProviderContext";
import { supabase } from "@/lib/supabase";
import { formatChatTime, isImageText } from "@/utils/chat";

interface ChatConversation {
  id: string;
  provider_id: string;
  client_id: string;
  last_message_at: string;
  last_message_text: string | null;
  provider_unread: number;
  client: { full_name: string | null; avatar_url: string | null } | null;
}

function ChatListContent() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useLanguage();
  const { provider } = useProvider();
  const router = useRouter();
  const providerId = provider?.id || null;

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!providerId) return;
    const { data } = await supabase
      .from("chat_conversations")
      .select(
        "id, provider_id, client_id, last_message_at, last_message_text, provider_unread, client:profiles(full_name, avatar_url)"
      )
      .eq("provider_id", providerId)
      .order("last_message_at", { ascending: false });
    setConversations((data as unknown as ChatConversation[]) || []);
    setLoading(false);
  }, [providerId]);

  // setTimeout — effekt ichida sinxron setState bo'lmasligi uchun
  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  // Suhbatlar o'zgarsa (yangi xabar, o'qildi) ro'yxatni yangilaymiz
  useEffect(() => {
    if (!providerId) return;
    // Unikal topic — boshqa komponentdagi obuna bilan to'qnashmasin
    const channel = supabase
      .channel(`chat-list-${providerId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_conversations", filter: `provider_id=eq.${providerId}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [providerId, load]);

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <PageHeader title={t("chat.title")} />

      {loading && conversations.length === 0 ? (
        <Spinner />
      ) : conversations.length === 0 ? (
        <Card>
          <EmptyState icon={MessageCircle} title={t("chat.empty")} desc={t("chat.empty_desc")} />
        </Card>
      ) : (
        conversations.map((c) => (
          <Pressable key={c.id} onPress={() => router.push(`/chat/${c.id}` as Href)}>
            {({ pressed }) => (
              <Card style={[styles.row, pressed && { opacity: 0.85 }]}>
                <ClientAvatar
                  name={c.client?.full_name || null}
                  avatarUrl={c.client?.avatar_url}
                  size={44}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.rowTop}>
                    <Text
                      style={[styles.name, c.provider_unread > 0 && { fontWeight: "800" }]}
                      numberOfLines={1}
                    >
                      {c.client?.full_name || t("chat.client")}
                    </Text>
                    <Text style={styles.time}>{formatChatTime(c.last_message_at, t)}</Text>
                  </View>
                  <View style={styles.rowBottom}>
                    <Text
                      style={[
                        styles.preview,
                        c.provider_unread > 0 && { color: colors.onSurface, fontWeight: "600" },
                      ]}
                      numberOfLines={1}
                    >
                      {isImageText(c.last_message_text)
                        ? t("chat.photo")
                        : c.last_message_text || t("chat.no_messages")}
                    </Text>
                    {c.provider_unread > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>
                          {c.provider_unread > 99 ? "99+" : c.provider_unread}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </Card>
            )}
          </Pressable>
        ))
      )}
    </Screen>
  );
}

export default function ChatListScreen() {
  return (
    <BusinessGate>
      <ChatListContent />
    </BusinessGate>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  row: {
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  name: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.onSurface },
  time: { fontSize: 11, color: colors.onSurfaceVariant },
  rowBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginTop: 3,
  },
  preview: { flex: 1, fontSize: 13, color: colors.onSurfaceVariant },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadText: { fontSize: 10, fontWeight: "800", color: colors.onPrimary },
}));
