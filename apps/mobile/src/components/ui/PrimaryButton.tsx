import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import type { ReactNode } from "react";
import { colors, fontFamily, radius, touchTarget } from "@/theme";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "success" | "danger";
type Size = "md" | "lg" | "sm";

export function PrimaryButton({
  title,
  onPress,
  variant = "primary",
  size = "lg",
  disabled = false,
  loading = false,
  icon,
  style,
  accessibilityHint,
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  style?: ViewStyle;
  accessibilityHint?: string;
}) {
  const v = variants[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        sizes[size],
        { backgroundColor: pressed ? v.pressed : v.bg, borderColor: v.border ?? "transparent" },
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <View style={styles.row}>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <Text style={[styles.text, { color: v.text }, size === "sm" && styles.textSm]}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const variants: Record<Variant, { bg: string; pressed: string; text: string; border?: string }> = {
  primary: { bg: colors.blue600, pressed: colors.blue700, text: colors.white },
  secondary: {
    bg: colors.surfaceOnDark,
    pressed: "rgba(255,255,255,0.12)",
    text: colors.white,
    border: colors.borderOnDark,
  },
  outline: {
    bg: colors.white,
    pressed: colors.slate50,
    text: colors.navy950,
    border: colors.borderOnLight,
  },
  ghost: { bg: "transparent", pressed: "rgba(7,17,31,0.06)", text: colors.blue700 },
  success: { bg: colors.greenDark, pressed: "#166534", text: colors.white },
  danger: { bg: colors.red, pressed: "#DC2626", text: colors.white },
};

const sizes: Record<Size, ViewStyle> = {
  sm: { minHeight: touchTarget, paddingHorizontal: 14, borderRadius: radius.md },
  md: { minHeight: touchTarget + 4, paddingHorizontal: 18, borderRadius: radius.md },
  lg: { minHeight: 54, paddingHorizontal: 22, borderRadius: radius.lg },
};

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center", borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  icon: { marginRight: 2 },
  text: { fontFamily: fontFamily.bold, fontSize: 16, letterSpacing: -0.2 },
  textSm: { fontSize: 14 },
  disabled: { opacity: 0.55 },
});
