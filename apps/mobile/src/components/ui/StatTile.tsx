import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { colors, fontFamily, radius, shadow } from "@/theme";

export function StatTile({
  label,
  value,
  tone = "light",
  accent,
  style,
}: {
  label: string;
  value: string;
  tone?: "light" | "dark";
  accent?: string;
  style?: ViewStyle;
}) {
  const dark = tone === "dark";
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`${label}: ${value}`}
      style={[styles.base, dark ? styles.dark : styles.light, !dark && shadow, style]}
    >
      <Text
        style={[styles.value, { color: accent ?? (dark ? colors.white : colors.navy950) }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text
        style={[styles.label, { color: dark ? colors.steel400 : colors.textMutedOnLight }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  light: { backgroundColor: colors.white },
  dark: { backgroundColor: colors.surfaceOnDark, borderWidth: 1, borderColor: colors.borderOnDark },
  value: { fontFamily: fontFamily.extrabold, fontSize: 24, letterSpacing: -0.6, lineHeight: 28 },
  label: {
    marginTop: 4,
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
});
