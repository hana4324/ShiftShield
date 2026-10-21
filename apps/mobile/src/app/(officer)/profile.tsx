import { Ionicons } from "@expo/vector-icons";
import { BUSINESS } from "@shiftshield/shared/constants";
import { router } from "expo-router";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { RatingStars } from "@/components/ui/RatingStars";
import { Screen, ScreenTitle } from "@/components/ui/Screen";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatTile } from "@/components/ui/StatTile";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DEMO_OFFICER, DEMO_OFFICER_PROFILE, DEMO_VERIFICATION } from "@/lib/demo-data";
import { APP_VERSION } from "@/lib/env";
import { useDemoStore } from "@/store/demo-store";
import { colors, fontFamily } from "@/theme";

export default function ProfileScreen() {
  const payoutsEnabled = useDemoStore((s) => s.payoutsEnabled);
  const connectPayouts = useDemoStore((s) => s.connectPayouts);
  const setRole = useDemoStore((s) => s.setRole);
  const resetDemo = useDemoStore((s) => s.resetDemo);

  const steps = DEMO_VERIFICATION.map((st) =>
    st.key === "payouts" && payoutsEnabled
      ? { ...st, status: "done" as const, detail: "Bank connected via Stripe" }
      : st,
  );
  const allDone = steps.every((s) => s.status === "done");

  const startConnect = () => {
    // Production: open the Stripe Connect Express onboarding link from the create-connect-onboarding-link Edge Function.
    Alert.alert(
      "Stripe Connect",
      "Stripe hosts the identity and bank form. ShiftShield never sees your bank details.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Continue (demo)", onPress: connectPayouts },
      ],
    );
  };

  const signOut = () => {
    setRole(null);
    resetDemo();
    router.replace("/");
  };

  return (
    <Screen tone="dark">
      <ScreenTitle title="Profile" />
      <Card tone="dark">
        <View style={styles.identity}>
          <Avatar name={DEMO_OFFICER.name} size={64} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{DEMO_OFFICER.name}</Text>
            <Text style={styles.meta}>Level III Commissioned Security Officer</Text>
            <View style={{ marginTop: 6 }}>
              <RatingStars value={DEMO_OFFICER.ratingAvg} count={DEMO_OFFICER.ratingCount} onDark />
            </View>
          </View>
        </View>
        <View style={styles.tiles}>
          <StatTile tone="dark" label="Completed" value={String(DEMO_OFFICER.completedShifts)} />
          <StatTile
            tone="dark"
            label="Reliability"
            value={`${DEMO_OFFICER.reliabilityPct}%`}
            accent={colors.green}
          />
          <StatTile
            tone="dark"
            label="Radius"
            value={`${DEMO_OFFICER_PROFILE.travelRadiusMi} mi`}
          />
        </View>
      </Card>

      <View>
        <SectionHeader title="Verification status" onDark />
        <Card tone="dark" style={{ marginTop: 8 }} padded={false}>
          <View style={styles.statusHeader}>
            <StatusBadge
              status={allDone ? "active" : "pending"}
              label={allDone ? "Ready to work" : "Action needed"}
            />
            <Text style={styles.statusHint}>
              {allDone
                ? "You can accept any shift that matches your license."
                : "You can still accept shifts; finish this before your first payout."}
            </Text>
          </View>
          {steps.map((st, i) => (
            <View key={st.key} style={[styles.stepRow, i > 0 && styles.stepBorder]}>
              <Ionicons
                name={
                  st.status === "done"
                    ? "checkmark-circle"
                    : st.status === "pending"
                      ? "time"
                      : "alert-circle"
                }
                size={22}
                color={
                  st.status === "done"
                    ? colors.green
                    : st.status === "pending"
                      ? colors.amber
                      : colors.amber
                }
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.stepLabel}>{st.label}</Text>
                {st.detail ? <Text style={styles.stepDetail}>{st.detail}</Text> : null}
              </View>
              {st.key === "payouts" && !payoutsEnabled ? (
                <PrimaryButton title="Connect" size="sm" onPress={startConnect} />
              ) : null}
            </View>
          ))}
        </Card>
      </View>

      <View>
        <SectionHeader title="License" onDark />
        <Card tone="dark" style={{ marginTop: 8 }}>
          <Row label="Texas DPS license" value={DEMO_OFFICER_PROFILE.licenseNumber} />
          <Row label="Level" value="Level III (armed)" />
          <Row label="Expires" value="Aug 31, 2027" />
          <Row label="Certifications" value={DEMO_OFFICER_PROFILE.certifications.join(", ")} />
          <Row
            label="Age verification"
            value={DEMO_OFFICER_PROFILE.is21Plus ? "21+" : "18+"}
            last
          />
        </Card>
      </View>

      <View>
        <SectionHeader title="Account" onDark />
        <Card tone="dark" style={{ marginTop: 8 }} padded={false}>
          <MenuRow
            icon="person-outline"
            label="Edit profile"
            onPress={() => Alert.alert("Demo", "Profile editing is wired in Phase 2.")}
          />
          <MenuRow
            icon="location-outline"
            label="Home city & travel radius"
            value={`${DEMO_OFFICER.homeCity} · ${DEMO_OFFICER_PROFILE.travelRadiusMi} mi`}
            onPress={() => Alert.alert("Demo", "Editable in Phase 2.")}
          />
          <MenuRow
            icon="notifications-outline"
            label="Notifications"
            value="Push + SMS for urgent"
            onPress={() => Alert.alert("Demo", "Notification preferences arrive in Phase 3.")}
          />
          <MenuRow
            icon="document-text-outline"
            label="Legal"
            value="Terms, privacy, contractor agreement"
            onPress={() => Linking.openURL("https://shiftshield-phi.vercel.app/legal/terms")}
          />
          <MenuRow
            icon="call-outline"
            label="Contact ShiftShield"
            value={BUSINESS.phone}
            onPress={() => Linking.openURL(`tel:${BUSINESS.phoneE164}`)}
            last
          />
        </Card>
      </View>

      <PrimaryButton
        title="Switch role / sign out"
        variant="secondary"
        size="md"
        onPress={signOut}
      />
      <Text style={styles.version}>
        ShiftShield v{APP_VERSION} · {BUSINESS.address.full}
      </Text>
    </Screen>
  );
}

function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.kv, !last && styles.kvBorder]}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function MenuRow({
  icon,
  label,
  value,
  onPress,
  last = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value?: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        !last && styles.stepBorder,
        pressed && { opacity: 0.8 },
      ]}
    >
      <Ionicons name={icon} size={20} color={colors.steel400} />
      <View style={{ flex: 1 }}>
        <Text style={styles.stepLabel}>{label}</Text>
        {value ? <Text style={styles.stepDetail}>{value}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.steel400} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: "row", alignItems: "center", gap: 14 },
  name: { color: colors.white, fontFamily: fontFamily.extrabold, fontSize: 20 },
  meta: { marginTop: 2, color: colors.steel400, fontFamily: fontFamily.medium, fontSize: 13 },
  tiles: { flexDirection: "row", gap: 10, marginTop: 16 },
  statusHeader: {
    padding: 14,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderOnDark,
  },
  statusHint: {
    color: colors.steel400,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    minHeight: 58,
    paddingVertical: 8,
  },
  stepBorder: { borderTopWidth: 1, borderTopColor: colors.borderOnDark },
  stepLabel: { color: colors.white, fontFamily: fontFamily.semibold, fontSize: 15 },
  stepDetail: {
    marginTop: 2,
    color: colors.steel400,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  kv: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 10 },
  kvBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderOnDark },
  kvLabel: { color: colors.steel400, fontFamily: fontFamily.medium, fontSize: 13 },
  kvValue: {
    flex: 1,
    textAlign: "right",
    color: colors.white,
    fontFamily: fontFamily.semibold,
    fontSize: 13,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    minHeight: 56,
    paddingVertical: 8,
  },
  version: {
    textAlign: "center",
    color: colors.steel400,
    fontFamily: fontFamily.regular,
    fontSize: 11,
    lineHeight: 16,
  },
});
