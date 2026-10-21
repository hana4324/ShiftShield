import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { initials } from "@/lib/format";
import { colors, fontFamily } from "@/theme";

const PALETTE = ["#1E63E9", "#0A4FB5", "#13294B", "#2563EB", "#1D4ED8", "#0F3B82"];

function hue(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}

export function Avatar({
  name,
  size = 44,
  style,
  ring = false,
}: {
  name: string;
  size?: number;
  style?: ViewStyle;
  ring?: boolean;
}) {
  return (
    <View
      accessibilityLabel={name}
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: hue(name) },
        ring && styles.ring,
        style,
      ]}
    >
      <Text style={[styles.text, { fontSize: Math.round(size * 0.38) }]}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
  ring: { borderWidth: 2, borderColor: colors.white },
  text: { color: colors.white, fontFamily: fontFamily.bold },
});
