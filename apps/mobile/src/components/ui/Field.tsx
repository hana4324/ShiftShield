import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import type { ReactNode } from "react";
import { colors, fontFamily, radius, touchTarget } from "@/theme";

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.label}>{children}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function TextField({
  label,
  error,
  hint,
  prefix,
  suffix,
  style,
  ...rest
}: TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <View style={style}>
      <Label hint={hint}>{label}</Label>
      <View
        style={[
          styles.inputWrap,
          error ? styles.inputError : null,
          rest.multiline && styles.multiline,
        ]}
      >
        {prefix ? <Text style={styles.affix}>{prefix}</Text> : null}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.steel400}
          style={[styles.input, rest.multiline && styles.inputMultiline]}
          {...rest}
        />
        {suffix ? <Text style={styles.affix}>{suffix}</Text> : null}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Single-select pills. */
export function ChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View>
      {label ? <Label>{label}</Label> : null}
      <View style={styles.chips}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(o.value)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Multi-select checklist rows. */
export function CheckList({
  label,
  options,
  values,
  onToggle,
}: {
  label?: string;
  options: readonly { value: string; label: string }[];
  values: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <View>
      {label ? <Label>{label}</Label> : null}
      <View style={styles.checkList}>
        {options.map((o, i) => {
          const checked = values.includes(o.value);
          return (
            <Pressable
              key={o.value}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              onPress={() => onToggle(o.value)}
              style={[styles.checkRow, i > 0 && styles.checkRowBorder]}
            >
              <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                {checked ? <Text style={styles.checkmark}>✓</Text> : null}
              </View>
              <Text style={styles.checkLabel}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={styles.toggleRow}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description ? <Text style={styles.toggleDesc}>{description}</Text> : null}
      </View>
      <View style={[styles.track, value && styles.trackOn]}>
        <View style={[styles.thumb, value && styles.thumbOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 6,
  },
  label: { fontFamily: fontFamily.semibold, fontSize: 14, color: colors.navy950 },
  hint: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textFaintOnLight },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: touchTarget + 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderOnLight,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
  },
  multiline: { alignItems: "flex-start", minHeight: 100 },
  inputError: { borderColor: colors.red },
  input: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    color: colors.navy950,
    paddingVertical: 10,
  },
  inputMultiline: { textAlignVertical: "top", minHeight: 96 },
  affix: { fontFamily: fontFamily.semibold, fontSize: 15, color: colors.textMutedOnLight },
  error: { marginTop: 6, fontFamily: fontFamily.medium, fontSize: 13, color: colors.red },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: touchTarget - 4,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderOnLight,
    backgroundColor: colors.white,
    justifyContent: "center",
  },
  chipSelected: { backgroundColor: colors.blue600, borderColor: colors.blue600 },
  chipText: { fontFamily: fontFamily.semibold, fontSize: 14, color: colors.navy950 },
  chipTextSelected: { color: colors.white },
  checkList: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderOnLight,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: touchTarget + 4,
    paddingHorizontal: 14,
  },
  checkRowBorder: { borderTopWidth: 1, borderTopColor: colors.borderOnLight },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.steel400,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.blue600, borderColor: colors.blue600 },
  checkmark: { color: colors.white, fontFamily: fontFamily.bold, fontSize: 14, lineHeight: 16 },
  checkLabel: { fontFamily: fontFamily.medium, fontSize: 15, color: colors.navy950, flex: 1 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: touchTarget + 8,
    paddingVertical: 8,
  },
  toggleLabel: { fontFamily: fontFamily.semibold, fontSize: 15, color: colors.navy950 },
  toggleDesc: {
    marginTop: 2,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: colors.textMutedOnLight,
  },
  track: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(7,17,31,0.18)",
    padding: 3,
  },
  trackOn: { backgroundColor: colors.green },
  thumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.white },
  thumbOn: { alignSelf: "flex-end" },
});
