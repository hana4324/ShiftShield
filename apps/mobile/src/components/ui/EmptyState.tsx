import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import type { ComponentProps } from "react";
import { PrimaryButton } from "./PrimaryButton";
import { colors, fontFamily, radius } from "@/theme";

export function EmptyState({
  icon = "shield-outline",
  title,
  body,
  actionTitle,
  onAction,
  tone = "light",
}: {
  icon?: ComponentProps<typeof Ionicons>["name"];
  title: string;
  body?: string;
  actionTitle?: string;
  onAction?: () => void;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <View style={[styles.base, dark ? styles.dark : styles.light]}>
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: dark ? "rgba(30,99,233,0.18)" : "rgba(30,99,233,0.10)" },
        ]}
      >
        <Ionicons name={icon} size={26} color={colors.blue600} />
      </View>
      <Text style={[styles.title, { color: dark ? colors.white : colors.navy950 }]}>{title}</Text>
      {body ? (
        <Text style={[styles.body, { color: dark ? colors.steel400 : colors.textMutedOnLight }]}>
          {body}
        </Text>
      ) : null}
      {actionTitle && onAction ? (
        <PrimaryButton title={actionTitle} onPress={onAction} size="md" style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderRadius: radius.lg,
  },
  light: { backgroundColor: colors.white },
  dark: { backgroundColor: colors.surfaceOnDark, borderWidth: 1, borderColor: colors.borderOnDark },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: { fontFamily: fontFamily.bold, fontSize: 17, textAlign: "center" },
  body: {
    marginTop: 6,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 300,
  },
  action: { marginTop: 18, alignSelf: "stretch" },
});
