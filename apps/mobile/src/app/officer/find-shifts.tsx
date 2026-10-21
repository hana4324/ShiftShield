import { Ionicons } from "@expo/vector-icons";
import { formatCents } from "@shiftshield/shared/money";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Marker } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MapPin } from "@/components/MapPin";
import { ShiftCard } from "@/components/ShiftCard";
import { ShiftMap } from "@/components/ShiftMap";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChoiceChips } from "@/components/ui/Field";
import { Screen } from "@/components/ui/Screen";
import { DEMO_OFFICER } from "@/lib/demo-data";
import { fmtMiles, fmtTimeRange } from "@/lib/format";
import { regionFor } from "@/lib/geo";
import { nearbyOpenShifts, useDemoStore } from "@/store/demo-store";
import { colors, fontFamily, radius, shadow, touchTarget } from "@/theme";

type View_ = "list" | "map";
type Filter = "all" | "tonight" | "armed" | "urgent";

export default function FindShiftsScreen() {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<View_>("list");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const shifts = useDemoStore((s) => s.shifts);
  const sites = useDemoStore((s) => s.sites);
  const assignments = useDemoStore((s) => s.assignments);
  const applications = useDemoStore((s) => s.applications);
  const bookmarks = useDemoStore((s) => s.bookmarks);
  const toggleBookmark = useDemoStore((s) => s.toggleBookmark);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const todayEnd = new Date();
    todayEnd.setHours(36, 0, 0, 0);
    return nearbyOpenShifts({ shifts, sites, assignments, applications }).filter(
      ({ shift, site }) => {
        if (
          q &&
          !`${shift.title} ${site.name} ${site.city} ${site.typeLabel}`.toLowerCase().includes(q)
        )
          return false;
        if (filter === "tonight") return new Date(shift.startAt) <= todayEnd;
        if (filter === "armed") return shift.armedRequired;
        if (filter === "urgent") return shift.isUrgent;
        return true;
      },
    );
  }, [shifts, sites, assignments, applications, query, filter]);

  const selected = results.find((r) => r.shift.id === selectedId) ?? null;
  const region = useMemo(
    () => regionFor([DEMO_OFFICER.home, ...results.map((r) => r.site.geo)]),
    [results],
  );

  const openShift = (id: string) => router.push({ pathname: "/shift/[id]", params: { id } });

  return (
    <Screen
      title="Find Shifts"
      back
      scroll={false}
      tone="dark"
      contentStyle={{ padding: 0, gap: 0 }}
    >
      <View style={styles.toolbar}>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.steel400} />
          <TextInput
            accessibilityLabel="Search shifts"
            placeholder="Search by site, city, or role"
            placeholderTextColor={colors.steel400}
            value={query}
            onChangeText={setQuery}
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filters"
          onPress={() => setShowFilters((v) => !v)}
          style={[styles.filterBtn, (showFilters || filter !== "all") && styles.filterBtnOn]}
        >
          <Ionicons name="options-outline" size={20} color={colors.white} />
        </Pressable>
      </View>

      {showFilters ? (
        <View style={styles.filters}>
          <ChoiceChips<Filter>
            options={[
              { value: "all", label: "All" },
              { value: "tonight", label: "Tonight" },
              { value: "urgent", label: "Urgent" },
              { value: "armed", label: "Armed (L3)" },
            ]}
            value={filter}
            onChange={setFilter}
          />
        </View>
      ) : null}

      <View style={styles.segment}>
        {(["list", "map"] as const).map((v) => (
          <Pressable
            key={v}
            accessibilityRole="tab"
            accessibilityState={{ selected: view === v }}
            onPress={() => setView(v)}
            style={[styles.segmentBtn, view === v && styles.segmentOn]}
          >
            <Ionicons
              name={v === "list" ? "list" : "map"}
              size={16}
              color={view === v ? colors.navy950 : colors.white}
            />
            <Text style={[styles.segmentText, view === v && styles.segmentTextOn]}>
              {v === "list" ? "List View" : "Map View"}
            </Text>
          </Pressable>
        ))}
        <Text style={styles.count}>{results.length} open</Text>
      </View>

      {view === "list" ? (
        <View style={styles.listWrap}>
          {results.length === 0 ? (
            <EmptyState
              tone="dark"
              icon="search-outline"
              title="No shifts match"
              body="Try clearing the filter or widening your travel radius in Profile."
              actionTitle="Clear filters"
              onAction={() => {
                setFilter("all");
                setQuery("");
              }}
            />
          ) : (
            results.map(({ shift, site, distanceMi }) => (
              <ShiftCard
                key={shift.id}
                shift={shift}
                site={site}
                distanceMi={distanceMi}
                bookmarked={bookmarks.includes(shift.id)}
                onToggleBookmark={() => toggleBookmark(shift.id)}
                onPress={() => openShift(shift.id)}
              />
            ))
          )}
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <ShiftMap initialRegion={region} onPress={() => setSelectedId(null)}>
            <Marker coordinate={DEMO_OFFICER.home} title="Home" anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.homeDot} />
            </Marker>
            {results.map(({ shift, site }) => (
              <Marker
                key={shift.id}
                coordinate={site.geo}
                anchor={{ x: 0.5, y: 1 }}
                onPress={() => setSelectedId(shift.id)}
                tracksViewChanges={false}
              >
                <MapPin
                  label={formatCents(shift.hourlyRateCents, { compact: true })}
                  selected={shift.id === selectedId}
                />
              </Marker>
            ))}
          </ShiftMap>

          {selected ? (
            <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
              <Pressable
                accessibilityRole="button"
                onPress={() => openShift(selected.shift.id)}
                style={styles.sheetBody}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle}>{selected.shift.title}</Text>
                  <Text style={styles.sheetMeta}>
                    {selected.site.typeLabel} · {selected.site.city} ·{" "}
                    {fmtMiles(selected.distanceMi)}
                  </Text>
                  <Text style={styles.sheetMeta}>
                    {fmtTimeRange(selected.shift.startAt, selected.shift.endAt)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 8 }}>
                  <Text style={styles.sheetRate}>
                    {formatCents(selected.shift.hourlyRateCents, { compact: true })}
                    <Text style={styles.sheetUnit}>/hr</Text>
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      bookmarks.includes(selected.shift.id) ? "Remove bookmark" : "Bookmark shift"
                    }
                    onPress={() => toggleBookmark(selected.shift.id)}
                    hitSlop={8}
                    style={styles.bookmark}
                  >
                    <Ionicons
                      name={bookmarks.includes(selected.shift.id) ? "bookmark" : "bookmark-outline"}
                      size={20}
                      color={colors.blue600}
                    />
                  </Pressable>
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => openShift(selected.shift.id)}
                style={styles.sheetCta}
              >
                <Text style={styles.sheetCtaText}>View details</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.white} />
              </Pressable>
            </View>
          ) : (
            <View style={[styles.mapHint, { bottom: insets.bottom + 16 }]} pointerEvents="none">
              <Text style={styles.mapHintText}>Tap a pin to preview the shift</Text>
            </View>
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 4 },
  search: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: touchTarget + 2,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceOnDark,
    borderWidth: 1,
    borderColor: colors.borderOnDark,
  },
  searchInput: {
    flex: 1,
    color: colors.white,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    paddingVertical: 8,
  },
  filterBtn: {
    width: touchTarget + 2,
    height: touchTarget + 2,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceOnDark,
    borderWidth: 1,
    borderColor: colors.borderOnDark,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBtnOn: { backgroundColor: colors.blue600, borderColor: colors.blue600 },
  filters: { paddingHorizontal: 16, paddingTop: 10 },
  segment: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  segmentBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.surfaceOnDark,
    borderWidth: 1,
    borderColor: colors.borderOnDark,
  },
  segmentOn: { backgroundColor: colors.white, borderColor: colors.white },
  segmentText: { color: colors.white, fontFamily: fontFamily.semibold, fontSize: 13 },
  segmentTextOn: { color: colors.navy950 },
  count: {
    marginLeft: "auto",
    color: colors.steel400,
    fontFamily: fontFamily.medium,
    fontSize: 13,
  },
  listWrap: {
    flex: 1,
    backgroundColor: colors.slate50,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    gap: 10,
  },
  homeDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.white,
    borderWidth: 4,
    borderColor: colors.blue600,
  },
  sheet: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 0,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: 14,
    gap: 10,
    ...shadow,
  },
  sheetBody: { flexDirection: "row", gap: 12 },
  sheetTitle: { color: colors.navy950, fontFamily: fontFamily.extrabold, fontSize: 17 },
  sheetMeta: {
    marginTop: 2,
    color: colors.textMutedOnLight,
    fontFamily: fontFamily.medium,
    fontSize: 13,
  },
  sheetRate: {
    color: colors.greenDark,
    fontFamily: fontFamily.extrabold,
    fontSize: 24,
    letterSpacing: -0.5,
  },
  sheetUnit: { fontSize: 13, color: colors.textMutedOnLight, fontFamily: fontFamily.semibold },
  bookmark: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  sheetCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: touchTarget + 4,
    borderRadius: radius.md,
    backgroundColor: colors.blue600,
  },
  sheetCtaText: { color: colors.white, fontFamily: fontFamily.bold, fontSize: 15 },
  mapHint: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "rgba(7,17,31,0.85)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  mapHintText: { color: colors.white, fontFamily: fontFamily.medium, fontSize: 13 },
});
