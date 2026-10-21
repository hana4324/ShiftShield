import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import {
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
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { DEMO_COMPANY, DEMO_OFFICER } from "@/lib/demo-data";
import { fmtTime } from "@/lib/format";
import { useDemoStore } from "@/store/demo-store";
import { colors, fontFamily, radius, touchTarget } from "@/theme";

export default function ThreadScreen() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const insets = useSafeAreaInsets();
  const role = useDemoStore((s) => s.role);
  const thread = useDemoStore((s) => s.threads.find((t) => t.id === threadId));
  const messages = useDemoStore((s) => s.messages.filter((m) => m.threadId === threadId));
  const sendMessage = useDemoStore((s) => s.sendMessage);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const meId = role === "employer" ? DEMO_COMPANY.id : DEMO_OFFICER.id;

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [messages.length]);

  if (!thread) {
    return (
      <Screen title="Messages" back>
        <EmptyState
          icon="chatbubbles-outline"
          title="Conversation not found"
          actionTitle="Go back"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    sendMessage(thread.id, body);
    setDraft("");
  };

  return (
    <Screen
      title={thread.title}
      subtitle="Shift chat · phone numbers shared during the booking window"
      back
      scroll={false}
      contentStyle={{ padding: 0, gap: 0 }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((m) => {
            const mine = m.senderId === meId;
            return (
              <View key={m.id} style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
                {!mine ? <Avatar name={m.senderName} size={30} /> : null}
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  {!mine ? <Text style={styles.sender}>{m.senderName}</Text> : null}
                  <Text style={[styles.body, mine && styles.bodyMine]}>{m.body}</Text>
                  <Text style={[styles.time, mine && styles.timeMine]}>{fmtTime(m.sentAt)}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <TextInput
            accessibilityLabel="Message"
            value={draft}
            onChangeText={setDraft}
            placeholder="Message the shift team"
            placeholderTextColor={colors.steel400}
            style={styles.input}
            multiline
            onSubmitEditing={send}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            onPress={send}
            disabled={!draft.trim()}
            style={[styles.send, !draft.trim() && { opacity: 0.4 }]}
          >
            <Ionicons name="send" size={18} color={colors.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10 },
  bubbleRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, maxWidth: "88%" },
  bubbleRowMine: { alignSelf: "flex-end" },
  bubble: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, flexShrink: 1 },
  bubbleTheirs: { backgroundColor: colors.white, borderBottomLeftRadius: 4 },
  bubbleMine: { backgroundColor: colors.blue600, borderBottomRightRadius: 4 },
  sender: { color: colors.blue700, fontFamily: fontFamily.semibold, fontSize: 11, marginBottom: 2 },
  body: { color: colors.navy950, fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 21 },
  bodyMine: { color: colors.white },
  time: {
    marginTop: 4,
    color: colors.textFaintOnLight,
    fontFamily: fontFamily.regular,
    fontSize: 10,
    alignSelf: "flex-end",
  },
  timeMine: { color: "rgba(255,255,255,0.7)" },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.borderOnLight,
  },
  input: {
    flex: 1,
    minHeight: touchTarget,
    maxHeight: 120,
    borderRadius: radius.lg,
    backgroundColor: colors.slate50,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    color: colors.navy950,
  },
  send: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    backgroundColor: colors.blue600,
    alignItems: "center",
    justifyContent: "center",
  },
});
