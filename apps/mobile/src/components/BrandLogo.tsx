import { StyleSheet, Text, View } from "react-native";
import { colors, fontFamily } from "@/theme";

/**
 * In-code placeholder for the ShiftShield logo (shield with a split blue/gray "S" + wordmark).
 * When the real files land in assets/brand/ (logo.png, logo-mark.png), replace the mark below with:
 *   <Image source={require("@/assets/brand/logo-mark.png")} style={{ width: size, height: size }} />
 */
export function BrandMark({ size = 56 }: { size?: number }) {
  const s = size;
  return (
    <View
      accessibilityLabel="ShiftShield"
      style={{ width: s, height: s, alignItems: "center", justifyContent: "center" }}
    >
      <View
        style={{
          width: s * 0.82,
          height: s * 0.95,
          backgroundColor: colors.navy900,
          borderWidth: Math.max(2, s * 0.045),
          borderColor: colors.blue600,
          borderTopLeftRadius: s * 0.14,
          borderTopRightRadius: s * 0.14,
          borderBottomLeftRadius: s * 0.44,
          borderBottomRightRadius: s * 0.44,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View style={{ flexDirection: "row" }}>
          <Text
            style={{
              fontFamily: fontFamily.extrabold,
              fontSize: s * 0.5,
              color: colors.blue700,
              lineHeight: s * 0.56,
            }}
          >
            S
          </Text>
        </View>
        <View
          style={{
            position: "absolute",
            right: s * 0.17,
            bottom: s * 0.16,
            width: s * 0.2,
            height: s * 0.26,
            backgroundColor: colors.navy900,
            opacity: 0,
          }}
        />
      </View>
    </View>
  );
}

export function BrandLogo({ size = 36, stacked = false }: { size?: number; stacked?: boolean }) {
  return (
    <View style={[styles.row, stacked && styles.stacked]}>
      <BrandMark size={stacked ? size * 2.2 : size} />
      <View style={styles.wordmark}>
        <Text style={[styles.word, styles.shift, { fontSize: stacked ? size * 0.9 : size * 0.62 }]}>
          SHIFT
        </Text>
        <Text
          style={[styles.word, styles.shield, { fontSize: stacked ? size * 0.9 : size * 0.62 }]}
        >
          SHIELD
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  stacked: { flexDirection: "column", gap: 14 },
  wordmark: { flexDirection: "row" },
  word: { fontFamily: fontFamily.extrabold, letterSpacing: 1.5 },
  shift: { color: colors.blue600 },
  shield: { color: colors.steel400 },
});
