import { StyleSheet, Text, View } from "react-native";
import { colors, fontFamily } from "@/theme";

/** Price-label pin used as a Marker child on the Find Shifts map. */
export function MapPin({
  label,
  selected = false,
  tone = "blue",
}: {
  label: string;
  selected?: boolean;
  tone?: "blue" | "green";
}) {
  const bg = tone === "green" ? colors.greenDark : selected ? colors.blue700 : colors.blue600;
  return (
    <View style={styles.wrap} accessibilityLabel={label}>
      <View style={[styles.pill, { backgroundColor: bg }, selected && styles.pillSelected]}>
        <Text style={styles.text}>{label}</Text>
      </View>
      <View style={[styles.tip, { borderTopColor: bg }]} />
    </View>
  );
}

/** Pulsing-style dot for an on-shift officer on the live map. */
export function OfficerPin({ name }: { name: string }) {
  return (
    <View style={styles.wrap} accessibilityLabel={`${name} on shift`}>
      <View style={styles.officerLabel}>
        <Text style={styles.officerText} numberOfLines={1}>
          {name}
        </Text>
      </View>
      <View style={styles.officerHalo}>
        <View style={styles.officerDot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.white,
  },
  pillSelected: { transform: [{ scale: 1.12 }] },
  text: { color: colors.white, fontFamily: fontFamily.extrabold, fontSize: 13 },
  tip: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -1,
  },
  officerLabel: {
    backgroundColor: colors.navy950,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 4,
    maxWidth: 140,
  },
  officerText: { color: colors.white, fontFamily: fontFamily.semibold, fontSize: 12 },
  officerHalo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(34,197,94,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  officerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.green,
    borderWidth: 2,
    borderColor: colors.white,
  },
});
