import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { fmtRelative } from "@/lib/format";
import { useDemoStore } from "@/store/demo-store";
import { colors, fontFamily } from "@/theme";

/** Thread list shared by the officer and employer Messages tabs. One thread per shift. */
export function MessagesList() {
  const threads = useDemoStore((s) => s.threads);
  const messages = useDemoStore((s) => s.messages);
  const role = useDemoStore((s) => s.role);

  if (threads.length === 0) {
    return (
      <EmptyState
        tone="dark"
        icon="chatbubbles-outline"
        title="No conversations yet"
        body="A chat thread opens automatically for every shift you're booked on."
      />
    );
  }

  return (
    <View style={styles.list}>
      {threads.map((t) => {
        const last = [...messages]
          .filter((m) => m.threadId === t.id)
          .sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0];
        const other = role === "employer" ? t.title : "Lone Star Protective";
        return (
          <Pressable
            key={t.id}
            accessibilityRole="button"
            accessibilityLabel={`Open conversation ${t.title}`}
            onPress={() =>
              router.push({ pathname: "/messages/[threadId]", params: { threadId: t.id } })
            }
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
          >
            <Avatar name={other} size={46} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={1}>
                  {t.title}
                </Text>
                {last ? <Text style={styles.time}>{fmtRelative(last.sentAt)}</Text> : null}
              </View>
              <Text style={styles.preview} numberOfLines={1}>
                {last ? `${last.senderName.split(" ")[0]}: ${last.body}` : "No messages yet"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.steel400} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surfaceOnDark,
    borderWidth: 1,
    borderColor: colors.borderOnDark,
    borderRadius: 16,
    padding: 12,
    minHeight: 70,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1, color: colors.white, fontFamily: fontFamily.bold, fontSize: 15 },
  time: { color: colors.steel400, fontFamily: fontFamily.medium, fontSize: 12 },
  preview: { marginTop: 2, color: colors.steel400, fontFamily: fontFamily.regular, fontSize: 13 },
});
