import { Ionicons } from "@expo/vector-icons";
import { formatCents } from "@shiftshield/shared/money";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { ShiftCard } from "@/components/ShiftCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChoiceChips } from "@/components/ui/Field";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen, ScreenTitle } from "@/components/ui/Screen";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DEMO_OFFICER } from "@/lib/demo-data";
import { fmtDayLabel, fmtTime, fmtTimeRange } from "@/lib/format";
import { distanceToSite, siteOf, useDemoStore } from "@/store/demo-store";
import { colors, fontFamily } from "@/theme";

type Tab = "upcoming" | "applied" | "completed";

export default function MyShiftsScreen() {
  const [tab, setTab] = useState<Tab>("upcoming");
  const shifts = useDemoStore((s) => s.shifts);
  const sites = useDemoStore((s) => s.sites);
  const assignments = useDemoStore((s) => s.assignments);
  const applications = useDemoStore((s) => s.applications);
  const bookmarks = useDemoStore((s) => s.bookmarks);
  const clockIn = useDemoStore((s) => s.clockIn);
  const clockOut = useDemoStore((s) => s.clockOut);
  const withdraw = useDemoStore((s) => s.withdraw);

  const mine = assignments.filter((a) => a.officerId === DEMO_OFFICER.id);
  const upcoming = mine.filter((a) => a.status === "confirmed" || a.status === "clocked_in");
  const completed = mine.filter((a) => a.status === "completed");
  const applied = applications.filter(
    (a) => a.officerId === DEMO_OFFICER.id && a.status === "applied",
  );
  const saved = shifts.filter((s) => bookmarks.includes(s.id) && s.status === "open");

  const onClockIn = (assignmentId: string, siteName: string) => {
    // Real flow: geofence check against the site (150 m default) with GPS + timestamp capture.
    Alert.alert("Clock in", `You're inside the ${siteName} geofence. Clock in now?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Clock in", onPress: () => clockIn(assignmentId) },
    ]);
  };

  return (
    <Screen tone="dark">
      <ScreenTitle title="My Shifts" subtitle="Upcoming, applications, and history" />
      <ChoiceChips<Tab>
        options={[
          { value: "upcoming", label: `Upcoming (${upcoming.length})` },
          { value: "applied", label: `Applied (${applied.length})` },
          { value: "completed", label: `Completed (${completed.length})` },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "upcoming" ? (
        upcoming.length === 0 ? (
          <EmptyState
            tone="dark"
            icon="calendar-outline"
            title="No upcoming shifts"
            body="Accept a shift and it will show up here with clock-in controls."
            actionTitle="Find shifts"
            onAction={() => router.push("/officer/find-shifts")}
          />
        ) : (
          upcoming.map((a) => {
            const shift = shifts.find((s) => s.id === a.shiftId)!;
            const site = siteOf(sites, shift.siteId);
            const live = a.status === "clocked_in";
            return (
              <View key={a.id} style={styles.block}>
                <ShiftCard
                  shift={shift}
                  site={site}
                  distanceMi={distanceToSite(site)}
                  onPress={() => router.push({ pathname: "/shift/[id]", params: { id: shift.id } })}
                  trailing={<StatusBadge status={live ? "clocked_in" : "confirmed"} size="sm" />}
                />
                <View style={styles.actionsRow}>
                  {live ? (
                    <>
                      <View style={styles.liveInfo}>
                        <Ionicons name="radio-outline" size={16} color={colors.green} />
                        <Text style={styles.liveText}>
                          Clocked in {a.clockInAt ? fmtTime(a.clockInAt) : ""} · location shared
                          with employer
                        </Text>
                      </View>
                      <PrimaryButton
                        title="Clock out"
                        variant="danger"
                        size="sm"
                        onPress={() => clockOut(a.id)}
                      />
                    </>
                  ) : (
                    <>
                      <Text style={styles.hint}>
                        Clock in opens 15 min before start, inside the site geofence.
                      </Text>
                      <PrimaryButton
                        title="Clock in"
                        variant="success"
                        size="sm"
                        onPress={() => onClockIn(a.id, site.name)}
                      />
                    </>
                  )}
                </View>
              </View>
            );
          })
        )
      ) : null}

      {tab === "applied" ? (
        <>
          {applied.length === 0 ? (
            <EmptyState
              tone="dark"
              icon="hourglass-outline"
              title="No pending applications"
              body="Shifts that use 'Review applicants' show here until the employer decides."
            />
          ) : (
            applied.map((app) => {
              const shift = shifts.find((s) => s.id === app.shiftId)!;
              const site = siteOf(sites, shift.siteId);
              return (
                <View key={app.id} style={styles.block}>
                  <ShiftCard
                    shift={shift}
                    site={site}
                    distanceMi={distanceToSite(site)}
                    onPress={() =>
                      router.push({ pathname: "/shift/[id]", params: { id: shift.id } })
                    }
                    trailing={<StatusBadge status="pending" label="Awaiting review" size="sm" />}
                  />
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => withdraw(shift.id)}
                    style={styles.withdraw}
                  >
                    <Text style={styles.withdrawText}>Withdraw application</Text>
                  </Pressable>
                </View>
              );
            })
          )}
          {saved.length > 0 ? (
            <View style={{ gap: 10 }}>
              <Text style={styles.sub}>Saved shifts</Text>
              {saved.map((shift) => {
                const site = siteOf(sites, shift.siteId);
                return (
                  <ShiftCard
                    key={shift.id}
                    shift={shift}
                    site={site}
                    distanceMi={distanceToSite(site)}
                    onPress={() =>
                      router.push({ pathname: "/shift/[id]", params: { id: shift.id } })
                    }
                  />
                );
              })}
            </View>
          ) : null}
        </>
      ) : null}

      {tab === "completed"
        ? completed.map((a) => {
            const shift = shifts.find((s) => s.id === a.shiftId)!;
            const site = siteOf(sites, shift.siteId);
            return (
              <View key={a.id} style={styles.completedRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.completedTitle}>{shift.title}</Text>
                  <Text style={styles.completedMeta}>
                    {site.typeLabel} · {fmtDayLabel(shift.startAt)} ·{" "}
                    {fmtTimeRange(shift.startAt, shift.endAt)}
                  </Text>
                  <View style={{ marginTop: 6 }}>
                    <StatusBadge status={a.approvalStatus ?? "pending"} onDark size="sm" />
                  </View>
                </View>
                <Text style={styles.completedPay}>{formatCents(a.paidCents ?? 0)}</Text>
              </View>
            );
          })
        : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 4,
  },
  hint: {
    flex: 1,
    color: colors.steel400,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  liveInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  liveText: {
    flex: 1,
    color: colors.white,
    fontFamily: fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  withdraw: { minHeight: 44, justifyContent: "center", alignItems: "center" },
  withdrawText: { color: colors.steel400, fontFamily: fontFamily.semibold, fontSize: 13 },
  sub: {
    color: colors.steel400,
    fontFamily: fontFamily.bold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 8,
  },
  completedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surfaceOnDark,
    borderWidth: 1,
    borderColor: colors.borderOnDark,
    borderRadius: 16,
    padding: 14,
  },
  completedTitle: { color: colors.white, fontFamily: fontFamily.bold, fontSize: 15 },
  completedMeta: {
    marginTop: 2,
    color: colors.steel400,
    fontFamily: fontFamily.medium,
    fontSize: 12,
  },
  completedPay: { color: colors.green, fontFamily: fontFamily.extrabold, fontSize: 20 },
});
