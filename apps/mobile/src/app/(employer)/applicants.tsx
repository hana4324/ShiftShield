import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ApplicantAvatarStack } from "@/components/ui/ApplicantAvatarStack";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen, ScreenTitle } from "@/components/ui/Screen";
import { fmtDayLabel, fmtTimeRange } from "@/lib/format";
import { officerOf, siteOf, useDemoStore } from "@/store/demo-store";
import { colors, fontFamily, radius } from "@/theme";

export default function ApplicantsTab() {
  const shifts = useDemoStore((s) => s.shifts);
  const sites = useDemoStore((s) => s.sites);
  const applications = useDemoStore((s) => s.applications);

  const groups = shifts
    .filter((s) => s.status === "open" || s.status === "filled")
    .map((shift) => ({
      shift,
      apps: applications.filter((a) => a.shiftId === shift.id && a.status === "applied"),
    }))
    .filter((g) => g.apps.length > 0);

  return (
    <Screen tone="dark">
      <ScreenTitle title="Applicants" subtitle="Officers waiting on your decision" />
      {groups.length === 0 ? (
        <EmptyState
          tone="dark"
          icon="people-outline"
          title="No applicants to review"
          body="Shifts set to 'Review applicants' collect officers here. Auto-accept shifts fill themselves."
        />
      ) : (
        groups.map(({ shift, apps }) => {
          const site = siteOf(sites, shift.siteId);
          return (
            <Pressable
              key={shift.id}
              accessibilityRole="button"
              accessibilityLabel={`Review ${apps.length} applicants for ${shift.title}`}
              onPress={() =>
                router.push({
                  pathname: "/employer/review/[shiftId]",
                  params: { shiftId: shift.id },
                })
              }
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{shift.title}</Text>
                <Text style={styles.meta}>
                  {site.name} · {fmtDayLabel(shift.startAt)} ·{" "}
                  {fmtTimeRange(shift.startAt, shift.endAt)}
                </Text>
                <View style={styles.row}>
                  <ApplicantAvatarStack
                    names={apps.map((a) => officerOf(a.officerId).name)}
                    size={30}
                  />
                  <Text style={styles.count}>
                    {apps.length} applicant{apps.length === 1 ? "" : "s"}
                  </Text>
                </View>
              </View>
              <View style={styles.reviewBtn}>
                <Text style={styles.reviewText}>Review ({apps.length})</Text>
              </View>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 14,
  },
  title: { color: colors.navy950, fontFamily: fontFamily.bold, fontSize: 16 },
  meta: {
    marginTop: 2,
    color: colors.textMutedOnLight,
    fontFamily: fontFamily.medium,
    fontSize: 13,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  count: { color: colors.textMutedOnLight, fontFamily: fontFamily.medium, fontSize: 13 },
  reviewBtn: {
    backgroundColor: colors.blue600,
    paddingHorizontal: 12,
    minHeight: 40,
    justifyContent: "center",
    borderRadius: radius.md,
  },
  reviewText: { color: colors.white, fontFamily: fontFamily.bold, fontSize: 13 },
});
