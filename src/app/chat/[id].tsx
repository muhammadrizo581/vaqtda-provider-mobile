// Chat — bitta suhbat (provayder tomoni).
// Provayder xabarlari o'ngda (primary), mijozniki chapda. Realtime INSERT/DELETE.
// Rasm yuborish: expo-image-picker → storage "chat-images" → image_url bilan xabar.
// O'chirish: o'z xabarini uzoq bosish → tasdiq (Alert).
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, ImagePlus, MessageCircle, Send } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AnimatedLogo } from "@/components/animated-logo";
import { useToast } from "@/components/pv/toast";
import { ClientAvatar, GlassSurface, liquidGlass, Spinner } from "@/components/pv/ui";
import { alpha } from "@/constants/colors";
import { useLanguage } from "@/context/LanguageContext";
import { makeThemedStyles, useColors } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";
import { chatImageUrl, formatChatDay, formatChatTime } from "@/utils/chat";

interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_role: "client" | "provider";
  body: string | null;
  image_url: string | null;
  is_read: boolean;
  created_at: string;
}

interface ConversationInfo {
  id: string;
  provider_id: string;
  client_id: string;
  client: { full_name: string | null; avatar_url: string | null } | null;
}

const MAX_IMAGE_MB = 5;

export default function ChatThreadScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const conversationId = typeof params.id === "string" ? params.id : null;

  const [conv, setConv] = useState<ConversationInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);

  // Mijoz xabarlarini o'qildi deb belgilash + o'z hisoblagichimizni nollash
  const markRead = useCallback(async () => {
    if (!conversationId) return;
    await supabase
      .from("chat_messages")
      .update({ is_read: true })
      .eq("conversation_id", conversationId)
      .eq("sender_role", "client")
      .eq("is_read", false);
    await supabase
      .from("chat_conversations")
      .update({ provider_unread: 0 })
      .eq("id", conversationId);
  }, [conversationId]);

  const load = useCallback(async () => {
    if (!conversationId) return;
    const [{ data: c }, { data: msgs }] = await Promise.all([
      supabase
        .from("chat_conversations")
        .select("id, provider_id, client_id, client:profiles(full_name, avatar_url)")
        .eq("id", conversationId)
        .maybeSingle(),
      supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true }),
    ]);
    setConv((c as unknown as ConversationInfo) || null);
    setMessages((msgs as ChatMessage[]) || []);
    setLoading(false);
    markRead();
  }, [conversationId, markRead]);

  // setTimeout — effekt ichida sinxron setState bo'lmasligi uchun
  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  // Yangi/o'chirilgan xabarlarga realtime obuna
  useEffect(() => {
    if (!conversationId) return;
    // Unikal topic — boshqa komponentdagi obuna bilan to'qnashmasin
    const channel = supabase
      .channel(`chat-thread-${conversationId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conversationId}` },
        (payload: { new: unknown }) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          // Suhbat ochiq — mijoz xabari darhol o'qildi bo'ladi
          if (msg.sender_role === "client") markRead();
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conversationId}` },
        (payload: { old: unknown }) => {
          const removed = payload.old as { id: string };
          setMessages((prev) => prev.filter((m) => m.id !== removed.id));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, markRead]);

  // Yangi xabarda pastga scroll
  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [messages.length]);

  const send = async () => {
    const text = body.trim();
    if (!text || !conversationId || sending) return;
    setSending(true);
    // Optimistik: darhol ko'rsatamiz
    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      conversation_id: conversationId,
      sender_role: "provider",
      body: text,
      image_url: null,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setBody("");
    const { data, error } = await supabase
      .from("chat_messages")
      .insert({ conversation_id: conversationId, sender_role: "provider", body: text })
      .select()
      .single();
    if (error || !data) {
      // Muvaffaqiyatsiz — optimistik xabarni olib tashlab, matnni qaytaramiz
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setBody(text);
      showToast(t("chat.send_failed"), "error");
    } else {
      const real = data as ChatMessage;
      setMessages((prev) =>
        prev.some((m) => m.id === real.id)
          ? prev.filter((m) => m.id !== tempId)
          : prev.map((m) => (m.id === tempId ? real : m))
      );
    }
    setSending(false);
  };

  // Galereyadan rasm tanlash → storage'ga yuklash → image_url bilan xabar
  const pickImage = async () => {
    if (!conversationId || uploading) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > MAX_IMAGE_MB * 1024 * 1024) {
      showToast(t("chat.img_too_big"), "error");
      return;
    }
    setUploading(true);
    try {
      const ext = (asset.uri.split(".").pop() || "jpg").toLowerCase();
      const contentType = asset.mimeType || `image/${ext === "jpg" ? "jpeg" : ext}`;
      const path = `${conversationId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      // RN'da faylni arraybuffer sifatida o'qib yuklaymiz
      const fileRes = await fetch(asset.uri);
      const buf = await fileRes.arrayBuffer();
      const { error: upErr } = await supabase.storage
        .from("chat-images")
        .upload(path, buf, { contentType, cacheControl: "3600" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("chat-images").getPublicUrl(path);
      const { data, error } = await supabase
        .from("chat_messages")
        .insert({ conversation_id: conversationId, sender_role: "provider", image_url: pub.publicUrl })
        .select()
        .single();
      if (error || !data) throw error;
      const real = data as ChatMessage;
      setMessages((prev) => (prev.some((m) => m.id === real.id) ? prev : [...prev, real]));
    } catch {
      showToast(t("chat.send_failed"), "error");
    } finally {
      setUploading(false);
    }
  };

  // O'z xabarini o'chirish — uzoq bosish + tasdiq
  const confirmDelete = (m: ChatMessage) => {
    if (m.sender_role !== "provider" || m.id.startsWith("temp-")) return;
    Alert.alert(t("chat.delete"), t("chat.delete_q"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("chat.delete"),
        style: "destructive",
        onPress: async () => {
          const before = messages;
          setMessages((prev) => prev.filter((x) => x.id !== m.id));
          const { error } = await supabase.from("chat_messages").delete().eq("id", m.id);
          if (error) {
            setMessages(before);
            showToast(t("chat.delete_failed"), "error");
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      {/* Sarlavha — shisha panel */}
      <GlassSurface
        style={[styles.header, { paddingTop: insets.top + 8 }]}
        fallbackStyle={styles.headerFallback}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color={colors.onSurface} />
        </Pressable>
        <ClientAvatar name={conv?.client?.full_name || null} avatarUrl={conv?.client?.avatar_url} size={36} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerName} numberOfLines={1}>
            {conv?.client?.full_name || t("chat.client")}
          </Text>
          <Text style={styles.headerSub}>{t("chat.client")}</Text>
        </View>
      </GlassSurface>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Xabarlar */}
        {loading ? (
          <Spinner style={{ flex: 1 }} />
        ) : (
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={[
              styles.messages,
              // Suzuvchi kompozer ostidan xabarlar oqib o'tadi — pastda joy qoldiramiz
              { paddingBottom: Math.max(insets.bottom, 10) + 66 },
            ]}
            keyboardDismissMode="interactive"
          >
            {messages.length === 0 && (
              <View style={styles.emptyWrap}>
                <MessageCircle size={26} color={alpha(colors.onSurfaceVariant, 0.5)} />
                <Text style={styles.emptyText}>{t("chat.no_messages")}</Text>
              </View>
            )}
            {messages.map((m, i) => {
              const mine = m.sender_role === "provider";
              // Rasm: image_url yoki body'dagi yalang'och rasm URL (xato klientga chidamlilik)
              const imgUrl = chatImageUrl(m);
              const textBody = imgUrl && !m.image_url ? null : m.body;
              const prevMsg = messages[i - 1];
              const newDay =
                !prevMsg ||
                new Date(prevMsg.created_at).toDateString() !== new Date(m.created_at).toDateString();
              return (
                <React.Fragment key={m.id}>
                  {/* Kun ajratgichi */}
                  {newDay && (
                    <View style={styles.dayWrap}>
                      <View style={styles.dayChip}>
                        <Text style={styles.dayText}>{formatChatDay(m.created_at, t)}</Text>
                      </View>
                    </View>
                  )}
                  <View style={[styles.msgRow, { justifyContent: mine ? "flex-end" : "flex-start" }]}>
                    <Pressable
                      onLongPress={() => confirmDelete(m)}
                      delayLongPress={350}
                      style={[
                        styles.bubble,
                        mine ? styles.bubbleMine : styles.bubbleTheirs,
                        imgUrl ? styles.bubbleImg : null,
                        m.id.startsWith("temp-") && { opacity: 0.7 },
                      ]}
                    >
                      {imgUrl && (
                        <Pressable onPress={() => Linking.openURL(imgUrl)}>
                          <Image
                            source={{ uri: imgUrl }}
                            style={styles.msgImage}
                            contentFit="cover"
                            transition={150}
                          />
                        </Pressable>
                      )}
                      {textBody ? (
                        <Text
                          style={[
                            styles.msgText,
                            { color: mine ? colors.onPrimary : colors.onSurface },
                            imgUrl ? { paddingHorizontal: 8, paddingTop: 6 } : null,
                          ]}
                        >
                          {textBody}
                        </Text>
                      ) : null}
                      <Text
                        style={[
                          styles.msgTime,
                          { color: mine ? alpha(colors.onPrimary, 0.7) : colors.onSurfaceVariant },
                          imgUrl ? { paddingHorizontal: 8, paddingBottom: 4 } : null,
                        ]}
                      >
                        {formatChatTime(m.created_at, t)}
                      </Text>
                    </Pressable>
                  </View>
                </React.Fragment>
              );
            })}
          </ScrollView>
        )}

        {/* Yuborish paneli — Telegram uslubida: xabarlar ostidan oqib o'tadigan
            suzuvchi shisha elementlar (rasm tugmasi, matn pilli, yuborish tugmasi) */}
        <View
          style={[
            styles.composer,
            { paddingBottom: Math.max(insets.bottom, 10) },
            !liquidGlass && styles.composerFallback,
          ]}
        >
          <GlassSurface style={styles.attachGlass} fallbackStyle={styles.attachFallback} interactive>
            <Pressable onPress={pickImage} disabled={uploading} style={styles.circleInner}>
              {uploading ? (
                <AnimatedLogo variant="loading" size={19} background={null} foreground={colors.primary} />
              ) : (
                <ImagePlus size={19} color={colors.onSurfaceVariant} />
              )}
            </Pressable>
          </GlassSurface>
          <GlassSurface style={styles.inputGlass} fallbackStyle={styles.inputFallback}>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder={t("chat.input_ph")}
              placeholderTextColor={colors.outline}
              multiline
              maxLength={4000}
              style={styles.input}
            />
          </GlassSurface>
          <GlassSurface
            style={styles.sendGlass}
            fallbackStyle={styles.sendFallback}
            tintColor={body.trim() ? colors.primary : undefined}
            interactive
          >
            <Pressable
              onPress={send}
              disabled={sending || !body.trim()}
              style={[styles.circleInner, (!body.trim() || sending) && { opacity: 0.5 }]}
            >
              {sending ? (
                <AnimatedLogo variant="loading" size={17} background={null} foreground={colors.onPrimary} />
              ) : (
                <Send
                  size={17}
                  // Shishada tint faqat matn borida yonadi — bo'sh holatda ikon xira;
                  // fallbackda fon doim primary, shuning uchun ikon doim oq
                  color={!liquidGlass || body.trim() ? colors.onPrimary : colors.onSurfaceVariant}
                />
              )}
            </Pressable>
          </GlassSurface>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 10,
    overflow: "hidden",
  },
  headerFallback: {
    backgroundColor: colors.surfaceContainerLow,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  backBtn: { padding: 6 },
  headerName: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  headerSub: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 1 },

  messages: { paddingHorizontal: 14, paddingTop: 14, gap: 6, flexGrow: 1 },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 60 },
  emptyText: { fontSize: 13, color: colors.onSurfaceVariant },

  dayWrap: { alignItems: "center", paddingVertical: 8 },
  dayChip: {
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  dayText: { fontSize: 10, fontWeight: "700", color: colors.onSurfaceVariant },

  msgRow: { flexDirection: "row" },
  bubble: {
    maxWidth: "80%",
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  bubbleTheirs: { backgroundColor: colors.surfaceContainerHigh, borderBottomLeftRadius: 6 },
  bubbleImg: { padding: 5 },
  msgImage: { width: 220, height: 220, borderRadius: 14 },
  msgText: { fontSize: 14, lineHeight: 20 },
  msgTime: { fontSize: 9.5, marginTop: 3, textAlign: "right" },

  // Kompozer xabarlar ustida suzadi — shisha effekt orqasida kontent ko'rinadi
  composer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  composerFallback: {
    backgroundColor: colors.surfaceContainerLow,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  attachGlass: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
  },
  attachFallback: {
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  circleInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  inputGlass: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    overflow: "hidden",
    justifyContent: "center",
  },
  inputFallback: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  input: {
    maxHeight: 110,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 12 : 9,
    paddingBottom: Platform.OS === "ios" ? 12 : 9,
    fontSize: 15,
    color: colors.onSurface,
  },
  sendGlass: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
  },
  sendFallback: {
    backgroundColor: colors.primary,
  },
}));
