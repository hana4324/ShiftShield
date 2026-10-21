import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fontFamily, touchTarget } from "@/theme";

/**
 * Standard screen chrome: navy app background, optional header with back button,
 * white "sheet" content area on light screens, scrollable by default.
 */
export function Screen({
  children,
  title,
  subtitle,
  back = false,
  right,
  tone = "sheet",
  scroll = true,
  contentStyle,
  refreshing,
  onRefresh,
  footer,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
  /** sheet = navy header + light content; dark = navy everywhere */
  tone?: "sheet" | "dark";
  scroll?: boolean;
  contentStyle?: ViewStyle;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const dark = tone === "dark";
  const Body = scroll ? ScrollView : View;
  return (
    <SafeAreaView edges={["top"]} style={styles.root}>
      <StatusBar style="light" />
      {title || back || right ? (
        <View style={styles.header}>
          {back ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
              hitSlop={8}
              style={styles.backBtn}
            >
              <Ionicons name="chevron-back" size={24} color={colors.white} />
            </Pressable>
          ) : (
            <View style={styles.backBtn} />
          )}
          <View style={styles.titleWrap}>
            {title ? (
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <View style={styles.right}>{right}</View>
        </View>
      ) : null}
      <Body
        style={[styles.body, dark ? styles.bodyDark : styles.bodySheet]}
        contentContainerStyle={
          scroll ? [styles.content, { paddingBottom: insets.bottom + 24 }, contentStyle] : undefined
        }
        keyboardShouldPersistTaps="handled"
        refreshControl={
          scroll && onRefresh ? (
            <RefreshControl
              refreshing={Boolean(refreshing)}
              onRefresh={onRefresh}
              tintColor={colors.blue600}
            />
          ) : undefined
        }
      >
        {scroll ? (
          children
        ) : (
          <View style={[styles.content, { flex: 1, paddingBottom: insets.bottom }, contentStyle]}>
            {children}
          </View>
        )}
      </Body>
      {footer ? (
        <View
          style={[
            styles.footer,
            dark ? styles.footerDark : styles.footerLight,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

export function ScreenTitle({
  title,
  subtitle,
  onDark = true,
}: {
  title: string;
  subtitle?: string;
  onDark?: boolean;
}) {
  return (
    <View style={styles.inlineTitle}>
      <Text style={[styles.inlineTitleText, { color: onDark ? colors.white : colors.navy950 }]}>
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={[
            styles.inlineSubtitle,
            { color: onDark ? colors.steel400 : colors.textMutedOnLight },
          ]}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.navy950 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, minHeight: 56 },
  backBtn: {
    width: touchTarget,
    height: touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  titleWrap: { flex: 1, alignItems: "center" },
  title: { color: colors.white, fontFamily: fontFamily.bold, fontSize: 17 },
  subtitle: { color: colors.steel400, fontFamily: fontFamily.medium, fontSize: 12, marginTop: 1 },
  right: { minWidth: touchTarget, alignItems: "flex-end", justifyContent: "center" },
  body: { flex: 1 },
  bodySheet: { backgroundColor: colors.slate50, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  bodyDark: { backgroundColor: colors.navy950 },
  content: { padding: 16, gap: 14 },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  footerLight: { backgroundColor: colors.white, borderTopColor: colors.borderOnLight },
  footerDark: { backgroundColor: colors.navy950, borderTopColor: colors.borderOnDark },
  inlineTitle: { marginBottom: 4 },
  inlineTitleText: { fontFamily: fontFamily.extrabold, fontSize: 26, letterSpacing: -0.5 },
  inlineSubtitle: { marginTop: 2, fontFamily: fontFamily.medium, fontSize: 14 },
});
