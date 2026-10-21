import { StyleSheet, Text, View } from "react-native";
import { statusTone, type StatusTone } from "@shiftshield/shared/tokens";
import { colors, fontFamily } from "@/theme";

const toneStyles: Record<StatusTone, { bg: string; fg: string; dot: string }> = {
  green: { bg: "rgba(34,197,94,0.14)", fg: "#15803D", dot: colors.green },
  amber: { bg: "rgba(245,158,11,0.16)", fg: "#B45309", dot: colors.amber },
  red: { bg: "rgba(239,68,68,0.14)", fg: "#B91C1C", dot: colors.red },
  gray: { bg: "rgba(154,159,166,0.22)", fg: "#4B5563", dot: colors.gray },
  blue: { bg: "rgba(30,99,233,0.14)", fg: colors.blue700, dot: colors.blue600 },
};

const labels: Record<string, string> = {
  open: "Searching",
  filled: "Filled",
  draft: "Draft",
  pending: "Pending",
  expired: "Expired",
  available: "Available",
  unavailable: "Unavailable",
  in_progress: "In progress",
  clocked_in: "On shift",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
  confirmed: "Confirmed",
  applied: "Applied",
  accepted: "Accepted",
  declined: "Declined",
  approved: "Approved",
  auto_approved: "Auto-approved",
  disputed: "Disputed",
  urgent: "Urgent",
};

export function StatusBadge({
  status,
  label,
  tone,
  onDark = false,
  size = "md",
}: {
  status: string;
  label?: string;
  tone?: StatusTone;
  onDark?: boolean;
  size?: "sm" | "md";
}) {
  const t = toneStyles[tone ?? statusTone[status] ?? (status === "urgent" ? "red" : "gray")];
  const text = label ?? labels[status] ?? status;
  return (
    <View
      accessibilityLabel={`Status: ${text}`}
      style={[
        styles.base,
        { backgroundColor: onDark ? "rgba(255,255,255,0.08)" : t.bg },
        size === "sm" && styles.sm,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: t.dot }]} />
      <Text
        style={[
          styles.text,
          { color: onDark ? colors.white : t.fg },
          size === "sm" && styles.textSm,
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sm: { paddingHorizontal: 8, paddingVertical: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontFamily: fontFamily.bold, fontSize: 12, letterSpacing: 0.2 },
  textSm: { fontSize: 11 },
});
