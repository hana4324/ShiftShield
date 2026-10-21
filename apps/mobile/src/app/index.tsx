import { Ionicons } from "@expo/vector-icons";
import { BUSINESS } from "@shiftshield/shared/constants";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandLogo } from "@/components/BrandLogo";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { DEMO_MODE } from "@/lib/env";
import type { Role } from "@/lib/demo-data";
import { useDemoStore } from "@/store/demo-store";
import { colors, fontFamily } from "@/theme";

export default function WelcomeScreen() {
  const setRole = useDemoStore((s) => s.setRole);

  const enter = (role: Role) => {
    setRole(role);
    router.replace(role === "officer" ? "/(officer)/home" : "/(employer)/dashboard");
  };

  const chooseRole = (role: Role) => {
    if (DEMO_MODE) return enter(role);
    setRole(role);
    router.push({ pathname: "/auth/sign-in", params: { role } });
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.hero}>
        <BrandLogo size={44} stacked />
        <Text style={styles.title}>{BUSINESS.positioning}</Text>
        <Text style={styles.pitch}>
          Post a shift, get matched with a licensed Texas officer, track them on site and pay only
          for approved hours. Officers keep every dollar of the posted rate.
        </Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          title="I'm a Security Officer"
          onPress={() => chooseRole("officer")}
          icon={<Ionicons name="shield-checkmark" size={20} color={colors.white} />}
        />
        <PrimaryButton
          title="I'm an Employer"
          variant="secondary"
          onPress={() => chooseRole("employer")}
          icon={<Ionicons name="business" size={20} color={colors.white} />}
        />
        {DEMO_MODE ? (
          <View style={styles.demoRow}>
            <Text style={styles.demoLabel}>Demo mode</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => enter("officer")}
              style={styles.demoBtn}
            >
              <Text style={styles.demoText}>Demo as Officer</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => enter("employer")}
              style={styles.demoBtn}
            >
              <Text style={styles.demoText}>Demo as Employer</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <Text style={styles.tagline}>{BUSINESS.secondaryLine}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.navy950, paddingHorizontal: 24 },
  hero: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  title: {
    marginTop: 12,
    textAlign: "center",
    color: colors.white,
    fontFamily: fontFamily.extrabold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.6,
    maxWidth: 320,
  },
  pitch: {
    textAlign: "center",
    color: colors.steel400,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 340,
  },
  actions: { gap: 12, paddingBottom: 12 },
  demoRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  demoLabel: {
    color: colors.steel400,
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  demoBtn: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.surfaceOnDark,
  },
  demoText: { color: colors.white, fontFamily: fontFamily.semibold, fontSize: 13 },
  tagline: {
    textAlign: "center",
    color: colors.steel400,
    fontFamily: fontFamily.bold,
    fontSize: 12,
    letterSpacing: 2.5,
    textTransform: "uppercase",
    paddingVertical: 18,
  },
});
