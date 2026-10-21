import { Ionicons } from "@expo/vector-icons";
import { formatCents, formatDuration } from "@shiftshield/shared/money";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen, ScreenTitle } from "@/components/ui/Screen";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatTile } from "@/components/ui/StatTile";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DEMO_OFFICER } from "@/lib/demo-data";
import { fmtDate, nowMs } from "@/lib/format";
import { siteOf, useDemoStore } from "@/store/demo-store";
import { colors, fontFamily } from "@/theme";

export default function EarningsScreen() {
  const shifts = useDemoStore((s) => s.shifts);
  const sites = useDemoStore((s) => s.sites);
  const assignments = useDemoStore((s) => s.assignments);
  const payoutsEnabled = useDemoStore((s) => s.payoutsEnabled);

  const completed = assignments
    .filter((a) => a.officerId === DEMO_OFFICER.id && a.status === "completed")
    .map((a) => ({ a, shift: shifts.find((s) => s.id === a.shiftId)! }))
    .sort((x, y) => new Date(y.shift.endAt).getTime() - new Date(x.shift.endAt).getTime());

  const weekAgo = nowMs() - 7 * 86_400_000;
  const thisWeek = completed.filter((c) => new Date(c.shift.endAt).getTime() >= weekAgo);
  const weekCents = thisWeek.reduce((s, c) => s + (c.a.paidCents ?? 0), 0);
  const weekMinutes = thisWeek.reduce((s, c) => s + (c.a.approvedMinutes ?? 0), 0);
  const pending = completed.filter((c) => c.a.approvalStatus === "pending");
  const pendingCents = pending.reduce(
    (s, c) => s + Math.round(((c.a.approvedMinutes ?? 0) / 60) * c.shift.hourlyRateCents),
    0,
  );
  const available = completed.filter(
    (c) => c.a.approvalStatus === "approved" || c.a.approvalStatus === "auto_approved",
  );
  const availableCents = available.reduce((s, c) => s + (c.a.paidCents ?? 0), 0);

  const cashOut = () => {
    // Daily pay: only when the employer's plan enables it and the Connect account supports instant payouts.
    Alert.alert(
      "Cash out now",
      `${formatCents(availableCents)} will arrive on your debit card in minutes (Stripe Instant Payout, 1% fee). Standard payouts are free and arrive in 2 business days.`,
      [
        { text: "Not now", style: "cancel" },
        {
          text: "Cash out",
          onPress: () =>
            Alert.alert(
              "Demo",
              "Instant payout requested. Stripe handles the transfer in production.",
            ),
        },
      ],
    );
  };

  return (
    <Screen tone="dark">
      <ScreenTitle title="Earnings" subtitle="You always receive the full posted rate" />

      <Card tone="dark">
        <Text style={styles.label}>This week</Text>
        <Text style={styles.big}>{formatCents(weekCents)}</Text>
        <Text style={styles.sub}>
          {thisWeek.length} shifts · {formatDuration(weekMinutes)} approved
        </Text>
        <View style={styles.tiles}>
          <StatTile
            tone="dark"
            label="Available"
            value={formatCents(availableCents, { compact: true })}
            accent={colors.green}
          />
          <StatTile
            tone="dark"
            label="Pending approval"
            value={formatCents(pendingCents, { compact: true })}
            accent={colors.amber}
          />
        </View>
        {payoutsEnabled ? (
          <PrimaryButton
            title="Cash out now"
            variant="success"
            size="md"
            onPress={cashOut}
            style={{ marginTop: 14 }}
            icon={<Ionicons name="flash" size={18} color={colors.white} />}
          />
        ) : (
          <View style={styles.payoutNote}>
            <Ionicons name="information-circle-outline" size={18} color={colors.amber} />
            <Text style={styles.payoutNoteText}>
              Connect your payout account in Profile to receive these funds. Payouts go straight to
              your bank through Stripe; ShiftShield never stores bank details.
            </Text>
          </View>
        )}
      </Card>

      <View>
        <SectionHeader title="Shift history" onDark />
        <View style={{ gap: 10, marginTop: 8 }}>
          {completed.map(({ a, shift }) => {
            const site = siteOf(sites, shift.siteId);
            return (
              <Card key={a.id} tone="dark">
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{shift.title}</Text>
                    <Text style={styles.rowMeta}>
                      {site.typeLabel} · {fmtDate(shift.startAt)} ·{" "}
                      {formatDuration(a.approvedMinutes ?? 0)} at{" "}
                      {formatCents(shift.hourlyRateCents)}/hr
                    </Text>
                    <View style={{ marginTop: 8 }}>
                      <StatusBadge status={a.approvalStatus ?? "pending"} onDark size="sm" />
                    </View>
                  </View>
                  <Text style={styles.rowPay}>{formatCents(a.paidCents ?? 0)}</Text>
                </View>
              </Card>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.steel400,
    fontFamily: fontFamily.bold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  big: {
    marginTop: 6,
    color: colors.white,
    fontFamily: fontFamily.extrabold,
    fontSize: 40,
    letterSpacing: -1,
  },
  sub: { marginTop: 2, color: colors.steel400, fontFamily: fontFamily.medium, fontSize: 14 },
  tiles: { flexDirection: "row", gap: 10, marginTop: 14 },
  payoutNote: { flexDirection: "row", gap: 8, marginTop: 14, alignItems: "flex-start" },
  payoutNoteText: {
    flex: 1,
    color: colors.steel400,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowTitle: { color: colors.white, fontFamily: fontFamily.bold, fontSize: 15 },
  rowMeta: {
    marginTop: 2,
    color: colors.steel400,
    fontFamily: fontFamily.medium,
    fontSize: 12,
    lineHeight: 17,
  },
  rowPay: { color: colors.green, fontFamily: fontFamily.extrabold, fontSize: 20 },
});
