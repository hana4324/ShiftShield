import { Ionicons } from "@expo/vector-icons";
import { formatCents, formatDuration } from "@shiftshield/shared/money";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SITE_ICON } from "@/components/ShiftCard";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DEMO_OFFICER } from "@/lib/demo-data";
import { fmtDateLong, fmtMiles, fmtRelative, fmtTimeRange, minutesBetween } from "@/lib/format";
import { directionsUrl } from "@/lib/geo";
import {
  bookedCount,
  distanceToSite,
  myStatusFor,
  officerOf,
  shiftCost,
  siteOf,
  useDemoStore,
} from "@/store/demo-store";
import { colors, fontFamily, radius } from "@/theme";

export default function ShiftDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const role = useDemoStore((s) => s.role);
  const shift = useDemoStore((s) => s.shifts.find((x) => x.id === id));
  const sites = useDemoStore((s) => s.sites);
  const assignments = useDemoStore((s) => s.assignments);
  const applications = useDemoStore((s) => s.applications);
  const bookmarks = useDemoStore((s) => s.bookmarks);
  const toggleBookmark = useDemoStore((s) => s.toggleBookmark);
  const acceptShift = useDemoStore((s) => s.acceptShift);
  const withdraw = useDemoStore((s) => s.withdraw);
  const publishDraft = useDemoStore((s) => s.publishDraft);
  const cancelShift = useDemoStore((s) => s.cancelShift);
  const [busy, setBusy] = useState(false);

  if (!shift) {
    return (
      <Screen title="Shift" back>
        <EmptyState
          icon="alert-circle-outline"
          title="Shift not found"
          body="It may have been removed."
          actionTitle="Go back"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  const site = siteOf(sites, shift.siteId);
  const minutes = minutesBetween(shift.startAt, shift.endAt);
  const total = Math.round((shift.hourlyRateCents * minutes) / 60);
  const booked = bookedCount(assignments, shift.id);
  const mine = myStatusFor({ assignments, applications }, shift.id);
  const isOfficer = role !== "employer";
  const qualifies = DEMO_OFFICER.licenseLevel >= shift.requiredLicenseLevel;
  const bookmarked = bookmarks.includes(shift.id);
  const cost = shiftCost(shift);
  const bookedOfficers = assignments
    .filter((a) => a.shiftId === shift.id && a.status !== "cancelled")
    .map((a) => officerOf(a.officerId));
  const pendingApps = applications.filter((a) => a.shiftId === shift.id && a.status === "applied");

  const onAccept = () => {
    setBusy(true);
    setTimeout(() => {
      const result = acceptShift(shift.id);
      setBusy(false);
      if (result === "booked") {
        Alert.alert(
          "You're booked",
          `${shift.title} at ${site.name} is confirmed. We'll remind you 24h and 2h before start.`,
          [
            { text: "View My Shifts", onPress: () => router.replace("/(officer)/my-shifts") },
            { text: "OK" },
          ],
        );
      } else if (result === "applied") {
        Alert.alert(
          "Application sent",
          "The employer reviews applicants and you'll get a push notification when they decide.",
        );
      } else if (result === "full") {
        Alert.alert(
          "Shift just filled",
          "Another officer accepted first. We'll alert you about similar shifts.",
        );
      } else if (result === "already") {
        Alert.alert("Already on it", "You've already accepted or applied to this shift.");
      } else {
        Alert.alert(
          "Can't accept yet",
          "Your license level does not meet this shift's requirement.",
        );
      }
    }, 450);
  };

  const footer = isOfficer ? (
    <View style={styles.footerRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={bookmarked ? "Remove bookmark" : "Bookmark shift"}
        onPress={() => toggleBookmark(shift.id)}
        style={styles.bookmarkBtn}
      >
        <Ionicons
          name={bookmarked ? "bookmark" : "bookmark-outline"}
          size={22}
          color={colors.blue600}
        />
      </Pressable>
      {mine.kind === "assignment" ? (
        <PrimaryButton
          title="Booked · View My Shifts"
          variant="success"
          style={{ flex: 1 }}
          onPress={() => router.replace("/(officer)/my-shifts")}
        />
      ) : mine.kind === "applied" ? (
        <PrimaryButton
          title="Applied · Withdraw"
          variant="outline"
          style={{ flex: 1 }}
          onPress={() => withdraw(shift.id)}
        />
      ) : shift.status !== "open" ? (
        <PrimaryButton title="No longer available" disabled style={{ flex: 1 }} />
      ) : !qualifies ? (
        <PrimaryButton
          title={`Requires Level ${shift.requiredLicenseLevel}`}
          disabled
          style={{ flex: 1 }}
        />
      ) : (
        <PrimaryButton
          title={shift.fillMode === "auto" ? "Accept Shift" : "Accept Shift (apply)"}
          loading={busy}
          style={{ flex: 1 }}
          onPress={onAccept}
        />
      )}
    </View>
  ) : (
    <View style={styles.footerRow}>
      {shift.status === "draft" ? (
        <PrimaryButton
          title="Publish shift"
          style={{ flex: 1 }}
          onPress={() => {
            publishDraft(shift.id);
            Alert.alert("Published", "Qualified officers nearby are being notified.");
          }}
        />
      ) : shift.status === "open" || shift.status === "filled" ? (
        <>
          <PrimaryButton
            title="Cancel"
            variant="outline"
            onPress={() =>
              Alert.alert("Cancel shift?", "Booked officers will be notified and refunds issued.", [
                { text: "Keep", style: "cancel" },
                {
                  text: "Cancel shift",
                  style: "destructive",
                  onPress: () => cancelShift(shift.id),
                },
              ])
            }
          />
          <PrimaryButton
            title={pendingApps.length > 0 ? `Review (${pendingApps.length})` : "Applicants"}
            style={{ flex: 1 }}
            onPress={() =>
              router.push({ pathname: "/employer/review/[shiftId]", params: { shiftId: shift.id } })
            }
          />
        </>
      ) : (
        <PrimaryButton
          title={shift.status === "in_progress" ? "View live map" : "Timesheet"}
          style={{ flex: 1 }}
          onPress={() => router.push("/employer/live-map")}
        />
      )}
    </View>
  );

  return (
    <Screen
      title={shift.title}
      subtitle={site.name}
      back
      footer={footer}
      contentStyle={{ padding: 0, gap: 0 }}
    >
      {/* Hero: site photo placeholder. Drop photos into assets/sites/<siteId>.jpg and use <Image> here. */}
      <View style={styles.hero}>
        <Ionicons name={SITE_ICON[site.type]} size={54} color="rgba(255,255,255,0.35)" />
        <View style={styles.heroBadges}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{site.typeLabel.toUpperCase()}</Text>
          </View>
          {shift.isUrgent ? <StatusBadge status="urgent" /> : null}
          {shift.status !== "open" ? <StatusBadge status={shift.status} /> : null}
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>{shift.title}</Text>
        <Text style={styles.when}>
          {fmtDateLong(shift.startAt)} · {fmtTimeRange(shift.startAt, shift.endAt)} ·{" "}
          {formatDuration(minutes)}
        </Text>

        <View style={styles.rateRow}>
          <Text style={styles.rate}>
            {formatCents(shift.hourlyRateCents)}
            <Text style={styles.rateUnit}>/hr</Text>
          </Text>
          <Text style={styles.total}>Total {formatCents(total)}</Text>
        </View>
        {isOfficer ? (
          <Text style={styles.payNote}>
            Paid in full after the employer approves your timesheet. No deductions.
          </Text>
        ) : (
          <View style={styles.costBox}>
            <Text style={styles.costLine}>
              Officer pay {formatCents(cost.totalOfficerPayCents)} + platform fee{" "}
              {formatCents(cost.totalPlatformFeeCents)}
            </Text>
            <Text style={styles.costTotal}>
              Your total: {formatCents(cost.totalCents)} for {shift.officersNeeded} officer
              {shift.officersNeeded > 1 ? "s" : ""}
            </Text>
          </View>
        )}

        <Card style={styles.section}>
          <View style={styles.locRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>{site.name}</Text>
              <Text style={styles.muted}>{site.address}</Text>
              {isOfficer ? (
                <Text style={styles.muted}>{fmtMiles(distanceToSite(site))} from home</Text>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="link"
              onPress={() => Linking.openURL(directionsUrl(site.geo, site.name))}
              style={styles.directions}
            >
              <Ionicons name="navigate" size={16} color={colors.white} />
              <Text style={styles.directionsText}>Get Directions</Text>
            </Pressable>
          </View>
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Requirements</Text>
          {shift.requirements.map((r) => (
            <View key={r.key} style={styles.reqRow}>
              <Ionicons
                name={r.met ? "checkmark-circle" : "close-circle"}
                size={20}
                color={r.met ? colors.green : colors.red}
              />
              <Text style={styles.reqText}>{r.label}</Text>
            </View>
          ))}
          <View style={styles.reqRow}>
            <Ionicons
              name={shift.armedRequired ? "shield" : "shield-outline"}
              size={20}
              color={colors.blue700}
            />
            <Text style={styles.reqText}>
              {shift.armedRequired ? "Armed post (Level III commission required)" : "Unarmed post"}
            </Text>
          </View>
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>About the post</Text>
          <Text style={styles.para}>{shift.description || "No description provided."}</Text>
          {site.postOrders ? (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Post orders</Text>
              <Text style={styles.para}>{site.postOrders}</Text>
            </>
          ) : null}
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Staffing</Text>
          <Text style={styles.muted}>
            {booked} of {shift.officersNeeded} filled ·{" "}
            {shift.fillMode === "auto"
              ? "Auto-accept first qualified"
              : "Employer reviews applicants"}{" "}
            · Posted {fmtRelative(shift.postedAt)}
          </Text>
          {!isOfficer && bookedOfficers.length > 0 ? (
            <View style={{ marginTop: 8, gap: 6 }}>
              {bookedOfficers.map((o) => (
                <Text key={o.id} style={styles.reqText}>
                  • {o.name} · Level {o.licenseLevel} · {o.ratingAvg.toFixed(1)}★
                </Text>
              ))}
            </View>
          ) : null}
          {isOfficer ? (
            <Text style={[styles.muted, { marginTop: 6 }]}>
              On-site contact and phone number are shared once you&apos;re booked.
            </Text>
          ) : (
            <Text style={[styles.muted, { marginTop: 6 }]}>
              On-site contact: {site.contactName} · {site.contactPhone}
            </Text>
          )}
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: 190,
    backgroundColor: colors.navy800,
    alignItems: "center",
    justifyContent: "center",
  },
  heroBadges: {
    position: "absolute",
    left: 16,
    bottom: 14,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  typeBadge: {
    backgroundColor: colors.blue600,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  typeBadgeText: {
    color: colors.white,
    fontFamily: fontFamily.bold,
    fontSize: 11,
    letterSpacing: 1,
  },
  body: { padding: 16, gap: 12 },
  title: {
    color: colors.navy950,
    fontFamily: fontFamily.extrabold,
    fontSize: 24,
    letterSpacing: -0.5,
  },
  when: {
    color: colors.textMutedOnLight,
    fontFamily: fontFamily.medium,
    fontSize: 14,
    marginTop: -6,
  },
  rateRow: { flexDirection: "row", alignItems: "baseline", gap: 12, marginTop: 4 },
  rate: {
    color: colors.greenDark,
    fontFamily: fontFamily.extrabold,
    fontSize: 34,
    letterSpacing: -1,
  },
  rateUnit: { fontSize: 16, color: colors.textMutedOnLight, fontFamily: fontFamily.semibold },
  total: { color: colors.navy950, fontFamily: fontFamily.bold, fontSize: 16 },
  payNote: {
    color: colors.textMutedOnLight,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    marginTop: -6,
  },
  costBox: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 12,
    gap: 2,
    borderWidth: 1,
    borderColor: colors.borderOnLight,
  },
  costLine: { color: colors.textMutedOnLight, fontFamily: fontFamily.medium, fontSize: 13 },
  costTotal: { color: colors.navy950, fontFamily: fontFamily.bold, fontSize: 15 },
  section: { gap: 6 },
  sectionTitle: { color: colors.navy950, fontFamily: fontFamily.bold, fontSize: 16 },
  muted: {
    color: colors.textMutedOnLight,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  locRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  directions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.blue600,
    paddingHorizontal: 12,
    minHeight: 40,
    borderRadius: 999,
  },
  directionsText: { color: colors.white, fontFamily: fontFamily.semibold, fontSize: 13 },
  reqRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 28 },
  reqText: { flex: 1, color: colors.navy950, fontFamily: fontFamily.medium, fontSize: 14 },
  para: { color: colors.navy950, fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 21 },
  footerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  bookmarkBtn: {
    width: 54,
    height: 54,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderOnLight,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
});
