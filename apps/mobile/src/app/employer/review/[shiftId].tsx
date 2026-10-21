import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { RatingStars } from "@/components/ui/RatingStars";
import { Screen } from "@/components/ui/Screen";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { fmtDayLabel, fmtMiles, fmtRelative, fmtTimeRange } from "@/lib/format";
import { distanceMiles } from "@/lib/geo";
import { bookedCount, officerOf, siteOf, useDemoStore } from "@/store/demo-store";
import { colors, fontFamily } from "@/theme";

export default function ReviewApplicantsScreen() {
  const { shiftId } = useLocalSearchParams<{ shiftId: string }>();
  const shift = useDemoStore((s) => s.shifts.find((x) => x.id === shiftId));
  const sites = useDemoStore((s) => s.sites);
  const applications = useDemoStore((s) => s.applications);
  const assignments = useDemoStore((s) => s.assignments);
  const confirmApplicant = useDemoStore((s) => s.confirmApplicant);
  const declineApplicant = useDemoStore((s) => s.declineApplicant);

  if (!shift) {
    return (
      <Screen title="Applicants" back>
        <EmptyState
          icon="alert-circle-outline"
          title="Shift not found"
          actionTitle="Go back"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  const site = siteOf(sites, shift.siteId);
  const pending = applications.filter((a) => a.shiftId === shift.id && a.status === "applied");
  const decided = applications.filter((a) => a.shiftId === shift.id && a.status !== "applied");
  const booked = bookedCount(assignments, shift.id);
  const remaining = shift.officersNeeded - booked;

  const onConfirm = (applicationId: string, name: string) => {
    const result = confirmApplicant(applicationId);
    if (result === "confirmed") {
      // Production: PaymentIntent on the saved card (transfer_group = assignment id) before confirming.
      Alert.alert(
        "Officer confirmed",
        `${name} is booked. Their shift total plus platform fee is now held on your card and released after you approve the timesheet.`,
      );
    } else {
      Alert.alert(
        "Shift is full",
        "All spots are filled. Post another shift if you need more coverage.",
      );
    }
  };

  return (
    <Screen title={`Review (${pending.length})`} subtitle={`${shift.title} · ${site.name}`} back>
      <Card>
        <Text style={styles.when}>
          {fmtDayLabel(shift.startAt)} · {fmtTimeRange(shift.startAt, shift.endAt)}
        </Text>
        <Text style={styles.spots}>
          {booked} of {shift.officersNeeded} spots filled
          {remaining > 0 ? ` · ${remaining} to go` : " · shift is full"}
        </Text>
      </Card>

      {pending.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No applicants waiting"
          body={
            shift.fillMode === "auto"
              ? "This shift auto-accepts the first qualified officers."
              : "Officers nearby have been notified. Mark it urgent to also send SMS alerts."
          }
        />
      ) : (
        pending.map((app) => {
          const o = officerOf(app.officerId);
          const dist = distanceMiles(o.home, site.geo);
          const qualifies = o.licenseLevel >= shift.requiredLicenseLevel;
          return (
            <Card key={app.id}>
              <View style={styles.head}>
                <Avatar name={o.name} size={52} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{o.name}</Text>
                  <RatingStars value={o.ratingAvg} count={o.ratingCount} />
                  <Text style={styles.meta}>Applied {fmtRelative(app.appliedAt)}</Text>
                </View>
                <StatusBadge
                  status={qualifies ? "approved" : "rejected"}
                  label={`Level ${o.licenseLevel}`}
                  size="sm"
                />
              </View>
              <View style={styles.stats}>
                <Stat label="Completed" value={String(o.completedShifts)} />
                <Stat label="Reliability" value={`${o.reliabilityPct}%`} />
                <Stat label="Distance" value={fmtMiles(dist)} />
                <Stat label="Lives in" value={o.homeCity.replace(", TX", "")} />
              </View>
              {!qualifies ? (
                <Text style={styles.warn}>
                  <Ionicons name="alert-circle" size={13} color={colors.red} /> License level below
                  this shift&apos;s requirement.
                </Text>
              ) : null}
              <View style={styles.actions}>
                <PrimaryButton
                  title="Decline"
                  variant="outline"
                  size="md"
                  onPress={() => declineApplicant(app.id)}
                />
                <PrimaryButton
                  title={remaining > 0 ? "Accept" : "Full"}
                  variant="success"
                  size="md"
                  style={{ flex: 1 }}
                  disabled={remaining <= 0 || !qualifies}
                  onPress={() => onConfirm(app.id, o.name)}
                />
              </View>
            </Card>
          );
        })
      )}

      {decided.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text style={styles.sectionTitle}>Decided</Text>
          {decided.map((app) => {
            const o = officerOf(app.officerId);
            return (
              <View key={app.id} style={styles.decidedRow}>
                <Avatar name={o.name} size={36} />
                <Text style={styles.decidedName}>{o.name}</Text>
                <StatusBadge status={app.status} size="sm" />
              </View>
            );
          })}
        </View>
      ) : null}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  when: { color: colors.navy950, fontFamily: fontFamily.bold, fontSize: 15 },
  spots: {
    marginTop: 2,
    color: colors.textMutedOnLight,
    fontFamily: fontFamily.medium,
    fontSize: 13,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { color: colors.navy950, fontFamily: fontFamily.bold, fontSize: 17 },
  meta: {
    marginTop: 2,
    color: colors.textFaintOnLight,
    fontFamily: fontFamily.regular,
    fontSize: 12,
  },
  stats: { flexDirection: "row", gap: 8, marginTop: 14 },
  stat: {
    flex: 1,
    backgroundColor: colors.slate50,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  statValue: { color: colors.navy950, fontFamily: fontFamily.extrabold, fontSize: 15 },
  statLabel: {
    marginTop: 2,
    color: colors.textMutedOnLight,
    fontFamily: fontFamily.semibold,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  warn: { marginTop: 10, color: colors.red, fontFamily: fontFamily.medium, fontSize: 13 },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  sectionTitle: {
    color: colors.textMutedOnLight,
    fontFamily: fontFamily.bold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  decidedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 10,
  },
  decidedName: { flex: 1, color: colors.navy950, fontFamily: fontFamily.semibold, fontSize: 14 },
});
