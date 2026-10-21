import { Ionicons } from "@expo/vector-icons";
import { BUSINESS, PLANS, formatPlanPrice } from "@shiftshield/shared/constants";
import { router } from "expo-router";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen, ScreenTitle } from "@/components/ui/Screen";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DEMO_COMPANY } from "@/lib/demo-data";
import { useDemoStore } from "@/store/demo-store";
import { colors, fontFamily } from "@/theme";

export default function MoreScreen() {
  const sites = useDemoStore((s) => s.sites);
  const setRole = useDemoStore((s) => s.setRole);
  const resetDemo = useDemoStore((s) => s.resetDemo);
  const plan = PLANS.find((p) => p.code === DEMO_COMPANY.plan)!;

  const signOut = () => {
    setRole(null);
    resetDemo();
    router.replace("/");
  };

  return (
    <Screen tone="dark">
      <ScreenTitle title="More" />
      <Card tone="dark">
        <View style={styles.identity}>
          <Avatar name={DEMO_COMPANY.name} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{DEMO_COMPANY.name}</Text>
            <Text style={styles.meta}>{DEMO_COMPANY.managerName} · Owner</Text>
          </View>
        </View>
      </Card>

      <View>
        <SectionHeader title="Subscription" onDark />
        <Card tone="dark" style={{ marginTop: 8 }}>
          <View style={styles.planRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.planName}>{plan.name} plan</Text>
              <Text style={styles.meta}>
                {formatPlanPrice(plan.priceCents)}/mo · {plan.monthlyBookingCap ?? "Unlimited"}{" "}
                bookings · {plan.maxSites ?? "Unlimited"} sites · {plan.feeBps / 100}% platform fee
              </Text>
            </View>
            <PrimaryButton
              title="Manage"
              size="sm"
              variant="secondary"
              onPress={() =>
                Alert.alert(
                  "Stripe Billing",
                  "Opens the Stripe customer portal in production (update card, change plan, invoices).",
                )
              }
            />
          </View>
          <Text style={styles.pilot}>Pilot: 30 days free, billing starts after the trial.</Text>
        </Card>
      </View>

      <View>
        <SectionHeader
          title="Sites"
          onDark
          actionLabel="Add site"
          onAction={() =>
            Alert.alert("Add site", "Places Autocomplete + geofence setup arrives in Phase 2.")
          }
        />
        <Card tone="dark" style={{ marginTop: 8 }} padded={false}>
          {sites.map((site, i) => (
            <View key={site.id} style={[styles.siteRow, i > 0 && styles.border]}>
              <Ionicons name="business-outline" size={20} color={colors.steel400} />
              <View style={{ flex: 1 }}>
                <Text style={styles.siteName}>{site.name}</Text>
                <Text style={styles.meta}>
                  {site.typeLabel} · {site.city} · geofence {site.geofenceRadiusM} m
                </Text>
              </View>
            </View>
          ))}
        </Card>
      </View>

      <View>
        <SectionHeader title="Company" onDark />
        <Card tone="dark" style={{ marginTop: 8 }} padded={false}>
          <MenuRow
            icon="people-outline"
            label="Managers"
            value="1 of 5 seats used"
            onPress={() =>
              Alert.alert(
                "Invite manager",
                "Email invites for Pro and Enterprise arrive in Phase 2.",
              )
            }
          />
          <MenuRow
            icon="map-outline"
            label="Live officer map"
            onPress={() => router.push("/employer/live-map")}
          />
          <MenuRow
            icon="document-text-outline"
            label="Reports & CSV export"
            value="Pro feature"
            onPress={() => Alert.alert("Reports", "Timesheet and spend exports arrive in Phase 4.")}
          />
          <MenuRow
            icon="shield-checkmark-outline"
            label="Incident reports"
            value="0 open"
            onPress={() =>
              Alert.alert(
                "Incident reports",
                "Officers file reports from the shift screen in Phase 3.",
              )
            }
          />
          <MenuRow
            icon="document-outline"
            label="Legal"
            value="Employer subscription agreement"
            onPress={() =>
              Linking.openURL("https://shiftshield-phi.vercel.app/legal/employer-agreement")
            }
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
    </Screen>
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
      style={({ pressed }) => [styles.menuRow, !last && styles.border, pressed && { opacity: 0.8 }]}
    >
      <Ionicons name={icon} size={20} color={colors.steel400} />
      <View style={{ flex: 1 }}>
        <Text style={styles.siteName}>{label}</Text>
        {value ? <Text style={styles.meta}>{value}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.steel400} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { color: colors.white, fontFamily: fontFamily.extrabold, fontSize: 18 },
  meta: {
    marginTop: 2,
    color: colors.steel400,
    fontFamily: fontFamily.medium,
    fontSize: 12,
    lineHeight: 17,
  },
  planRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  planName: { color: colors.white, fontFamily: fontFamily.bold, fontSize: 16 },
  pilot: { marginTop: 10, color: colors.green, fontFamily: fontFamily.semibold, fontSize: 12 },
  siteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    minHeight: 58,
    paddingVertical: 8,
  },
  border: { borderTopWidth: 1, borderTopColor: colors.borderOnDark },
  siteName: { color: colors.white, fontFamily: fontFamily.semibold, fontSize: 15 },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    minHeight: 56,
    paddingVertical: 8,
  },
});
