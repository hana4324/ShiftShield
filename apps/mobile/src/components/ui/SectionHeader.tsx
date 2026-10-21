import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontFamily, touchTarget } from "@/theme";

export function SectionHeader({
  title,
  actionLabel,
  onAction,
  onDark = false,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  onDark?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: onDark ? colors.steel400 : colors.textMutedOnLight }]}>
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8} style={styles.action}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 28,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  action: { minHeight: touchTarget - 12, justifyContent: "center" },
  actionText: { fontFamily: fontFamily.semibold, fontSize: 14, color: colors.blue600 },
});
