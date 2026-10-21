import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Circle, Marker } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OfficerPin } from "@/components/MapPin";
import { ShiftMap } from "@/components/ShiftMap";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { fmtTime, nowMs } from "@/lib/format";
import { distanceMeters, regionFor, type LatLng } from "@/lib/geo";
import { officerOf, siteOf, useDemoStore } from "@/store/demo-store";
import { colors, fontFamily, radius, shadow } from "@/theme";

/**
 * Simulated live location: the officer patrols a small loop around the site.
 * Production: Supabase Realtime subscription on location_pings for clocked-in assignments at this company's sites.
 */
function usePatrolPosition(center: LatLng, radiusM: number, running: boolean): LatLng {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setT((x) => x + 1), 1200);
    return () => clearInterval(id);
  }, [running]);
  const r = (radiusM * 0.6) / 111_320; // degrees latitude
  const angle = (t / 24) * Math.PI * 2;
  return {
    latitude: center.latitude + Math.sin(angle) * r,
    longitude:
      center.longitude + (Math.cos(angle) * r) / Math.cos((center.latitude * Math.PI) / 180),
  };
}

export default function LiveMapScreen() {
  const insets = useSafeAreaInsets();
  const sites = useDemoStore((s) => s.sites);
  const shifts = useDemoStore((s) => s.shifts);
  const assignments = useDemoStore((s) => s.assignments);
  const live = assignments.filter((a) => a.status === "clocked_in");
  const first = live[0];
  const shift = first ? shifts.find((s) => s.id === first.shiftId) : undefined;
  const site = shift ? siteOf(sites, shift.siteId) : sites[1]!;
  const officer = first ? officerOf(first.officerId) : null;
  const pos = usePatrolPosition(site.geo, site.geofenceRadiusM, Boolean(first));
  const insideFence = distanceMeters(pos, site.geo) <= site.geofenceRadiusM;
  const region = useMemo(
    () => ({ ...regionFor([site.geo]), latitudeDelta: 0.012, longitudeDelta: 0.012 }),
    [site.geo],
  );
  const [tick, setTick] = useState(nowMs);
  useEffect(() => {
    const id = setInterval(() => setTick(nowMs()), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <Screen
      title="Live Officer Map"
      subtitle={`${live.length} on shift`}
      back
      scroll={false}
      tone="dark"
      contentStyle={{ padding: 0 }}
    >
      {!first || !officer || !shift ? (
        <View style={{ padding: 16 }}>
          <EmptyState
            tone="dark"
            icon="map-outline"
            title="No officers clocked in"
            body="Officers appear here from clock-in to clock-out, with a location ping every 5 minutes."
            actionTitle="Back to dashboard"
            onAction={() => router.back()}
          />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <ShiftMap initialRegion={region}>
            <Circle
              center={site.geo}
              radius={site.geofenceRadiusM}
              strokeColor="rgba(30,99,233,0.9)"
              fillColor="rgba(30,99,233,0.15)"
              strokeWidth={2}
            />
            <Marker coordinate={site.geo} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <View style={styles.siteDot}>
                <Ionicons name="business" size={14} color={colors.white} />
              </View>
            </Marker>
            <Marker coordinate={pos} anchor={{ x: 0.5, y: 0.5 }}>
              <OfficerPin name={officer.name.split(" ")[0] ?? officer.name} />
            </Marker>
          </ShiftMap>

          <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.row}>
              <Avatar name={officer.name} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{officer.name}</Text>
                <Text style={styles.meta}>
                  {shift.title} · {site.name}
                </Text>
                <Text style={styles.meta}>
                  Clocked in {first.clockInAt ? fmtTime(first.clockInAt) : ""} · last ping{" "}
                  {new Date(tick).toLocaleTimeString("en-US", {
                    timeZone: "America/Chicago",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
              <StatusBadge
                status={insideFence ? "clocked_in" : "pending"}
                label={insideFence ? "On site" : "Outside fence"}
                tone={insideFence ? "green" : "amber"}
                size="sm"
              />
            </View>
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: "/messages/[threadId]",
                    params: { threadId: "thr_hospital" },
                  })
                }
                style={styles.action}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.blue700} />
                <Text style={styles.actionText}>Message</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => {}} style={styles.action}>
                <Ionicons name="call-outline" size={18} color={colors.blue700} />
                <Text style={styles.actionText}>Call (booking window)</Text>
              </Pressable>
            </View>
            <Text style={styles.footnote}>
              Location is shared only while clocked in at your site. Geofence {site.geofenceRadiusM}{" "}
              m.
            </Text>
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  siteDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.blue600,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  sheet: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 0,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: 14,
    gap: 12,
    ...shadow,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { color: colors.navy950, fontFamily: fontFamily.bold, fontSize: 16 },
  meta: {
    color: colors.textMutedOnLight,
    fontFamily: fontFamily.medium,
    fontSize: 12,
    marginTop: 1,
  },
  actions: { flexDirection: "row", gap: 8 },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.borderOnLight,
  },
  actionText: { color: colors.blue700, fontFamily: fontFamily.semibold, fontSize: 13 },
  footnote: { color: colors.textFaintOnLight, fontFamily: fontFamily.regular, fontSize: 11 },
});
