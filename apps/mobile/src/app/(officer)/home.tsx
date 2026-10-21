import { Ionicons } from "@expo/vector-icons";
import { formatCents } from "@shiftshield/shared/money";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ShiftCard } from "@/components/ShiftCard";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatTile } from "@/components/ui/StatTile";
import { DEMO_OFFICER } from "@/lib/demo-data";
import { nowMs } from "@/lib/format";
import { nearbyOpenShifts, useDemoStore } from "@/store/demo-store";
import { colors, fontFamily } from "@/theme";

export default function OfficerHome() {
  const isAvailable = useDemoStore((s) => s.isAvailable);
  const toggleAvailable = useDemoStore((s) => s.toggleAvailable);
  const shifts = useDemoStore((s) => s.shifts);
  const sites = useDemoStore((s) => s.sites);
  const assignments = useDemoStore((s) => s.assignments);
  const applications = useDemoStore((s) => s.applications);
  const bookmarks = useDemoStore((s) => s.bookmarks);
  const toggleBookmark = useDemoStore((s) => s.toggleBookmark);
  const payoutsEnabled = useDemoStore((s) => s.payoutsEnabled);

  const nearby = nearbyOpenShifts({ shifts, sites, assignments, applications });
  const weekAgo = nowMs() - 7 * 86_400_000;
  const completedThisWeek = assignments.filter((a) => {
    if (a.officerId !== DEMO_OFFICER.id || a.status !== "completed") return false;
    const shift = shifts.find((s) => s.id === a.shiftId);
    return shift ? new Date(shift.endAt).getTime() >= weekAgo : false;
  });
  const minutes = completedThisWeek.reduce((sum, a) => sum + (a.approvedMinutes ?? 0), 0);
  const earned = completedThisWeek.reduce((sum, a) => sum + (a.paidCents ?? 0), 0);
  const firstName = DEMO_OFFICER.name.split(" ")[0];

  return (
    <Screen tone="dark">
      <View style={styles.hero}>
        <View style={styles.greetingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Hi, {firstName}</Text>
            <View style={styles.cityRow}>
              <Ionicons name="location" size={14} color={colors.steel400} />
              <Text style={styles.city}>{DEMO_OFFICER.homeCity}</Text>
            </View>
          </View>
          <Avatar name={DEMO_OFFICER.name} size={46} />
        </View>

        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: isAvailable }}
          accessibilityLabel="Availability"
          onPress={toggleAvailable}
          style={[styles.toggle, isAvailable ? styles.toggleOn : styles.toggleOff]}
        >
          <View
            style={[
              styles.toggleDot,
              { backgroundColor: isAvailable ? colors.green : colors.gray },
            ]}
          />
          <Text style={styles.toggleText}>
            {isAvailable ? "Available for shifts" : "Unavailable"}
          </Text>
          <Text style={styles.toggleHint}>
            {isAvailable ? "Tap to pause alerts" : "Tap to go available"}
          </Text>
        </Pressable>
      </View>

      {!payoutsEnabled ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/(officer)/profile")}
          style={styles.banner}
        >
          <Ionicons name="card-outline" size={20} color={colors.amber} />
          <Text style={styles.bannerText}>
            Connect your payout account so your next shift pays out on time.
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.steel400} />
        </Pressable>
      ) : null}

      <View>
        <SectionHeader
          title="This week"
          onDark
          actionLabel="Earnings"
          onAction={() => router.push("/(officer)/earnings")}
        />
        <View style={styles.tiles}>
          <StatTile tone="dark" label="Shifts" value={String(completedThisWeek.length)} />
          <StatTile
            tone="dark"
            label="Hours"
            value={(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)}
          />
          <StatTile
            tone="dark"
            label="Earned"
            value={formatCents(earned, { compact: true })}
            accent={colors.green}
          />
        </View>
      </View>

      <View>
        <SectionHeader
          title="Nearby open shifts"
          onDark
          actionLabel="Find shifts"
          onAction={() => router.push("/officer/find-shifts")}
        />
        <View style={styles.list}>
          {nearby.length === 0 ? (
            <EmptyState
              tone="dark"
              icon="search-outline"
              title="No open shifts nearby"
              body="You'll get a push notification the moment an employer posts one within your travel radius."
              actionTitle="Browse the map"
              onAction={() => router.push("/officer/find-shifts")}
            />
          ) : (
            nearby
              .slice(0, 4)
              .map(({ shift, site, distanceMi }) => (
                <ShiftCard
                  key={shift.id}
                  shift={shift}
                  site={site}
                  distanceMi={distanceMi}
                  bookmarked={bookmarks.includes(shift.id)}
                  onToggleBookmark={() => toggleBookmark(shift.id)}
                  onPress={() => router.push({ pathname: "/shift/[id]", params: { id: shift.id } })}
                />
              ))
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 14 },
  greetingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  greeting: {
    color: colors.white,
    fontFamily: fontFamily.extrabold,
    fontSize: 28,
    letterSpacing: -0.6,
  },
  cityRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  city: { color: colors.steel400, fontFamily: fontFamily.medium, fontSize: 14 },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  toggleOn: { backgroundColor: "rgba(34,197,94,0.10)", borderColor: "rgba(34,197,94,0.35)" },
  toggleOff: { backgroundColor: colors.surfaceOnDark, borderColor: colors.borderOnDark },
  toggleDot: { width: 10, height: 10, borderRadius: 5 },
  toggleText: { flex: 1, color: colors.white, fontFamily: fontFamily.bold, fontSize: 15 },
  toggleHint: { color: colors.steel400, fontFamily: fontFamily.medium, fontSize: 12 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(245,158,11,0.10)",
    borderColor: "rgba(245,158,11,0.35)",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  bannerText: {
    flex: 1,
    color: colors.white,
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  tiles: { flexDirection: "row", gap: 10, marginTop: 8 },
  list: { gap: 10, marginTop: 8 },
});
