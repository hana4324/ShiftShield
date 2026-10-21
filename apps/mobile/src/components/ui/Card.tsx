import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import type { ReactNode } from "react";
import { colors, radius, shadow } from "@/theme";

export function Card({
  children,
  style,
  onPress,
  tone = "light",
  padded = true,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  tone?: "light" | "dark";
  padded?: boolean;
  accessibilityLabel?: string;
}) {
  const base = [
    styles.base,
    tone === "dark" ? styles.dark : [styles.light, shadow],
    padded && styles.padded,
    style,
  ];
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [base, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={base}>{children}</View>;
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.lg, overflow: "hidden" },
  light: { backgroundColor: colors.white },
  dark: { backgroundColor: colors.navy900, borderWidth: 1, borderColor: colors.borderOnDark },
  padded: { padding: 16 },
  pressed: { opacity: 0.92, transform: [{ scale: 0.995 }] },
});
