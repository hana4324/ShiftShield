import { Ionicons } from "@expo/vector-icons";
import { formatCents } from "@shiftshield/shared/money";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { SiteType } from "@shiftshield/shared/constants";
import type { Shift, Site } from "@/lib/demo-data";
import { fmtDayLabel, fmtMiles, fmtRelative, fmtTimeRange } from "@/lib/format";
import { colors, fontFamily, radius, shadow } from "@/theme";
import { StatusBadge } from "./ui/StatusBadge";

export const SITE_ICON: Record<SiteType, ComponentProps<typeof Ionicons>["name"]> = {
  senior_living: "home-outline",
  hospital: "medkit-outline",
  apartment: "business-outline",
  hotel: "bed-outline",
  construction: "construct-outline",
  corporate: "briefcase-outline",
  event: "ticket-outline",
  retail: "cart-outline",
  other: "location-outline",
};

export function ShiftCard({
  shift,
  site,
  distanceMi,
  onPress,
  bookmarked,
  onToggleBookmark,
  compact = false,
  trailing,
}: {
  shift: Shift;
  site: Site;
  distanceMi?: number;
  onPress?: () => void;
  bookmarked?: boolean;
  onToggleBookmark?: () => void;
  compact?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${shift.title} at ${site.name}, ${formatCents(shift.hourlyRateCents)} per hour`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, shadow, pressed && styles.pressed]}
    >
      <View style={styles.top}>
        <View style={styles.iconWrap}>
          <Ionicons name={SITE_ICON[site.type]} size={20} color={colors.blue700} />
        </View>
        <View style={styles.titleWrap}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {shift.title}
            </Text>
            {shift.isUrgent ? <StatusBadge status="urgent" size="sm" /> : null}
          </View>
          <Text style={styles.site} numberOfLines={1}>
            {site.typeLabel} · {site.city}
          </Text>
        </View>
        <View style={styles.ratePill}>
          <Text style={styles.rate}>{formatCents(shift.hourlyRateCents, { compact: true })}</Text>
          <Text style={styles.rateUnit}>/hr</Text>
        </View>
      </View>

      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={14} color={colors.textMutedOnLight} />
          <Text style={styles.metaText}>
            {compact ? "" : `${fmtDayLabel(shift.startAt)} · `}
            {fmtTimeRange(shift.startAt, shift.endAt)}
          </Text>
        </View>
        {distanceMi !== undefined ? (
          <View style={styles.metaItem}>
            <Ionicons name="navigate-outline" size={14} color={colors.textMutedOnLight} />
            <Text style={styles.metaText}>{fmtMiles(distanceMi)}</Text>
          </View>
        ) : null}
        <View style={styles.spacer} />
        {trailing ?? <Text style={styles.posted}>Posted {fmtRelative(shift.postedAt)}</Text>}
        {onToggleBookmark ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={bookmarked ? "Remove bookmark" : "Bookmark shift"}
            onPress={onToggleBookmark}
            hitSlop={10}
            style={styles.bookmark}
          >
            <Ionicons
              name={bookmarked ? "bookmark" : "bookmark-outline"}
              size={18}
              color={bookmarked ? colors.blue600 : colors.steel400}
            />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 14 },
  pressed: { opacity: 0.92 },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(30,99,233,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  titleWrap: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.navy950, flexShrink: 1 },
  site: {
    marginTop: 2,
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: colors.textMutedOnLight,
  },
  ratePill: {
    flexDirection: "row",
    alignItems: "baseline",
    backgroundColor: colors.greenDark,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  rate: { fontFamily: fontFamily.extrabold, fontSize: 15, color: colors.white },
  rateUnit: { fontFamily: fontFamily.semibold, fontSize: 10, color: colors.white, marginLeft: 1 },
  meta: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.textMutedOnLight },
  spacer: { flex: 1 },
  posted: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textFaintOnLight },
  bookmark: { marginLeft: 4 },
});
