import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { colors, fontFamily } from "@/theme";

export function RatingStars({
  value,
  count,
  size = 14,
  showValue = true,
  onDark = false,
}: {
  value: number;
  count?: number;
  size?: number;
  showValue?: boolean;
  onDark?: boolean;
}) {
  const stars = [1, 2, 3, 4, 5].map((i) => {
    const diff = value - i + 1;
    const name = diff >= 1 ? "star" : diff >= 0.5 ? "star-half" : "star-outline";
    return <Ionicons key={i} name={name} size={size} color={colors.amber} />;
  });
  return (
    <View
      accessibilityLabel={`Rated ${value.toFixed(1)} out of 5${count ? ` from ${count} ratings` : ""}`}
      style={styles.row}
    >
      <View style={styles.stars}>{stars}</View>
      {showValue ? (
        <Text
          style={[styles.value, { color: onDark ? colors.white : colors.navy950, fontSize: size }]}
        >
          {value.toFixed(1)}
          {count !== undefined ? (
            <Text
              style={[styles.count, { color: onDark ? colors.steel400 : colors.textFaintOnLight }]}
            >
              {" "}
              ({count})
            </Text>
          ) : null}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  stars: { flexDirection: "row", gap: 1 },
  value: { fontFamily: fontFamily.bold },
  count: { fontFamily: fontFamily.regular },
});
