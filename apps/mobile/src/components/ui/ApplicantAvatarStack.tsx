import { StyleSheet, Text, View } from "react-native";
import { Avatar } from "./Avatar";
import { colors, fontFamily } from "@/theme";

export function ApplicantAvatarStack({
  names,
  max = 3,
  size = 30,
}: {
  names: string[];
  max?: number;
  size?: number;
}) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  if (names.length === 0) return null;
  return (
    <View accessibilityLabel={`${names.length} applicants`} style={styles.row}>
      {shown.map((n, i) => (
        <Avatar
          key={n + i}
          name={n}
          size={size}
          ring
          style={i > 0 ? { marginLeft: -size * 0.32 } : undefined}
        />
      ))}
      {extra > 0 ? (
        <View
          style={[
            styles.more,
            { width: size, height: size, borderRadius: size / 2, marginLeft: -size * 0.32 },
          ]}
        >
          <Text style={styles.moreText}>+{extra}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  more: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.slate50,
    borderWidth: 2,
    borderColor: colors.white,
  },
  moreText: { fontFamily: fontFamily.bold, fontSize: 11, color: colors.navy950 },
});
