import { Ionicons } from "@expo/vector-icons";
import { formatCents } from "@shiftshield/shared/money";
import { router } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { ShiftCard } from "@/components/ShiftCard";
import { ApplicantAvatarStack } from "@/components/ui/ApplicantAvatarStack";
import { EmptyState } from "@/components/ui/EmptyState";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatTile } from "@/components/ui/StatTile";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DEMO_COMPANY } from "@/lib/demo-data";
import { bookedCount, officerOf, shiftCost, siteOf, useDemoStore } from "@/store/demo-store";
import { colors, fontFamily, radius, touchTarget } from "@/theme";

export default function EmployerDashboard() {
  const shifts = useDemoStore((s) => s.shifts);
  const sites = useDemoStore((s) => s.sites);
  const applications = useDemoStore((s) => s.applications);
  const assignments = useDemoStore((s) => s.assignments);
  const siteFilter = useDemoStore((s) => s.selectedSiteFilter);
  const setSiteFilter = useDemoStore((s) => s.setSiteFilter);
  const [pickerOpen, setPickerOpen] = useState(false);

  const visible = shifts.filter((s) => (siteFilter ? s.siteId === siteFilter : true));
  const open = visible.filter((s) => s.status === "open");
  const filled = visible.filter((s) => s.status === "filled" || s.status === "in_progress");
  const pendingApps = applications.filter(
    (a) => a.status === "applied" && visible.some((s) => s.id === a.shiftId),
  );
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthSpend = visible
    .filter(
      (s) => s.status !== "draft" && s.status !== "cancelled" && new Date(s.startAt) >= monthStart,
    )
    .reduce((sum, s) => sum + shiftCost(s).totalCents, 0);
  const live = assignments.filter((a) => a.status === "clocked_in").length;
  const filterLabel = siteFilter ? siteOf(sites, siteFilter).name : "All locations";

  return (
    <Screen tone="dark">
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.company}>{DEMO_COMPANY.name}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Location filter: ${filterLabel}`}
            onPress={() => setPickerOpen(true)}
            style={styles.dropdown}
          >
            <Ionicons name="location-outline" size={16} color={colors.steel400} />
            <Text style={styles.dropdownText} numberOfLines={1}>
              {filterLabel}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.steel400} />
          </Pressable>
        </View>
        <View style={styles.planPill}>
          <Text style={styles.planText}>{DEMO_COMPANY.planName}</Text>
        </View>
      </View>

      <PrimaryButton
        title="Post New Shift"
        onPress={() => router.push("/employer/post-shift")}
        icon={<Ionicons name="add-circle" size={20} color={colors.white} />}
      />

      <View style={styles.tiles}>
        <StatTile
          tone="dark"
          label="Open shifts"
          value={String(open.length)}
          accent={colors.amber}
        />
        <StatTile tone="dark" label="Filled" value={String(filled.length)} accent={colors.green} />
      </View>
      <View style={styles.tiles}>
        <StatTile tone="dark" label="Pending review" value={String(pendingApps.length)} />
        <StatTile
          tone="dark"
          label="This month"
          value={formatCents(monthSpend, { compact: true })}
        />
      </View>

      {live > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/employer/live-map")}
          style={styles.liveBanner}
        >
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>
            {live} officer{live > 1 ? "s" : ""} on site right now
          </Text>
          <Text style={styles.liveLink}>Live map</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.blue600} />
        </Pressable>
      ) : null}

      <View style={styles.usage}>
        <Text style={styles.usageText}>
          {DEMO_COMPANY.bookingsUsed} of {DEMO_COMPANY.bookingCap} bookings used this month ·{" "}
          {DEMO_COMPANY.shiftsUsed} of {DEMO_COMPANY.shiftCap} shifts posted
        </Text>
        <View style={styles.usageTrack}>
          <View
            style={[
              styles.usageFill,
              {
                width: `${Math.round((DEMO_COMPANY.bookingsUsed / DEMO_COMPANY.bookingCap) * 100)}%`,
              },
            ]}
          />
        </View>
      </View>

      <View>
        <SectionHeader
          title="Open shifts"
          onDark
          actionLabel="All shifts"
          onAction={() => router.push("/(employer)/shifts")}
        />
        <View style={styles.list}>
          {open.length === 0 ? (
            <EmptyState
              tone="dark"
              icon="calendar-outline"
              title="No open shifts"
              body="Post a shift and qualified officers nearby are notified instantly."
              actionTitle="Post New Shift"
              onAction={() => router.push("/employer/post-shift")}
            />
          ) : (
            open.map((shift) => {
              const site = siteOf(sites, shift.siteId);
              const apps = applications.filter(
                (a) => a.shiftId === shift.id && a.status === "applied",
              );
              const booked = bookedCount(assignments, shift.id);
              return (
                <View key={shift.id} style={styles.shiftBlock}>
                  <ShiftCard
                    shift={shift}
                    site={site}
                    onPress={() =>
                      router.push({ pathname: "/shift/[id]", params: { id: shift.id } })
                    }
                    trailing={
                      <StatusBadge
                        status={booked > 0 ? "pending" : "open"}
                        label={
                          booked > 0 ? `${booked}/${shift.officersNeeded} booked` : "Searching"
                        }
                        size="sm"
                      />
                    }
                  />
                  <View style={styles.shiftFooter}>
                    <Text style={styles.needed}>
                      {shift.officersNeeded - booked} officer
                      {shift.officersNeeded - booked === 1 ? "" : "s"} needed
                    </Text>
                    <ApplicantAvatarStack
                      names={apps.map((a) => officerOf(a.officerId).name)}
                      size={28}
                    />
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        router.push({
                          pathname: "/employer/review/[shiftId]",
                          params: { shiftId: shift.id },
                        })
                      }
                      style={[styles.reviewBtn, apps.length === 0 && styles.reviewBtnMuted]}
                    >
                      <Text style={styles.reviewText}>
                        {apps.length > 0
                          ? `Review (${apps.length})`
                          : shift.fillMode === "auto"
                            ? "Auto-fill"
                            : "No applicants"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </View>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Filter by location</Text>
            {[
              { id: null, name: "All locations" },
              ...sites.map((s) => ({ id: s.id, name: s.name })),
            ].map((opt) => (
              <Pressable
                key={opt.id ?? "all"}
                accessibilityRole="radio"
                accessibilityState={{ selected: siteFilter === opt.id }}
                onPress={() => {
                  setSiteFilter(opt.id);
                  setPickerOpen(false);
                }}
                style={styles.option}
              >
                <Text style={[styles.optionText, siteFilter === opt.id && styles.optionOn]}>
                  {opt.name}
                </Text>
                {siteFilter === opt.id ? (
                  <Ionicons name="checkmark" size={20} color={colors.blue600} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  company: {
    color: colors.white,
    fontFamily: fontFamily.extrabold,
    fontSize: 20,
    letterSpacing: -0.3,
  },
  dropdown: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.surfaceOnDark,
    borderWidth: 1,
    borderColor: colors.borderOnDark,
    maxWidth: 260,
  },
  dropdownText: {
    color: colors.white,
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    flexShrink: 1,
  },
  planPill: {
    backgroundColor: "rgba(30,99,233,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  planText: {
    color: colors.blue600,
    fontFamily: fontFamily.bold,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  tiles: { flexDirection: "row", gap: 10 },
  liveBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(34,197,94,0.10)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.35)",
    borderRadius: 14,
    padding: 12,
    minHeight: touchTarget + 4,
  },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.green },
  liveText: { flex: 1, color: colors.white, fontFamily: fontFamily.semibold, fontSize: 14 },
  liveLink: { color: colors.blue600, fontFamily: fontFamily.bold, fontSize: 13 },
  usage: { gap: 6 },
  usageText: { color: colors.steel400, fontFamily: fontFamily.medium, fontSize: 12 },
  usageTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceOnDark,
    overflow: "hidden",
  },
  usageFill: { height: 6, backgroundColor: colors.blue600 },
  list: { gap: 12, marginTop: 8 },
  shiftBlock: { gap: 8 },
  shiftFooter: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4 },
  needed: { flex: 1, color: colors.steel400, fontFamily: fontFamily.medium, fontSize: 13 },
  reviewBtn: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.blue600,
    justifyContent: "center",
  },
  reviewBtnMuted: {
    backgroundColor: colors.surfaceOnDark,
    borderWidth: 1,
    borderColor: colors.borderOnDark,
  },
  reviewText: { color: colors.white, fontFamily: fontFamily.bold, fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: "rgba(7,17,31,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    paddingBottom: 32,
  },
  sheetTitle: { color: colors.navy950, fontFamily: fontFamily.bold, fontSize: 16, marginBottom: 8 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: touchTarget + 4,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderOnLight,
  },
  optionText: { color: colors.navy950, fontFamily: fontFamily.medium, fontSize: 15 },
  optionOn: { color: colors.blue700, fontFamily: fontFamily.bold },
});
