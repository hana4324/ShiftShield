import {
  colors as tokens,
  radii,
  spacing as spacingTokens,
  MIN_TOUCH_TARGET,
} from "@shiftshield/shared/tokens";
import { Platform, type TextStyle } from "react-native";

/** Flat color palette derived from the shared design tokens. */
export const colors = {
  navy950: tokens.navy[950],
  navy900: tokens.navy[900],
  navy800: tokens.navy[800],
  blue600: tokens.blue[600],
  blue700: tokens.blue[700],
  steel400: tokens.steel[400],
  white: tokens.white,
  slate50: tokens.slate[50],
  green: tokens.status.green,
  greenDark: tokens.status.greenDark,
  amber: tokens.status.amber,
  red: tokens.status.red,
  gray: tokens.status.gray,
  // derived
  textOnLight: tokens.navy[950],
  textMutedOnLight: "rgba(7, 17, 31, 0.62)",
  textFaintOnLight: "rgba(7, 17, 31, 0.45)",
  borderOnLight: "rgba(7, 17, 31, 0.10)",
  borderOnDark: "rgba(255, 255, 255, 0.12)",
  surfaceOnDark: "rgba(255, 255, 255, 0.06)",
} as const;

export const radius = radii;
export const spacing = spacingTokens;
export const touchTarget = MIN_TOUCH_TARGET;

export const fontFamily = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
} as const;

export const type = {
  display: { fontFamily: fontFamily.extrabold, fontSize: 34, lineHeight: 38, letterSpacing: -0.8 },
  h1: { fontFamily: fontFamily.extrabold, fontSize: 26, lineHeight: 31, letterSpacing: -0.5 },
  h2: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 25, letterSpacing: -0.3 },
  h3: { fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 22 },
  bodySemibold: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18 },
  smallMedium: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 18 },
  smallSemibold: { fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 18 },
  caption: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  money: { fontFamily: fontFamily.extrabold, fontSize: 28, lineHeight: 32, letterSpacing: -0.6 },
} satisfies Record<string, TextStyle>;

export const shadow = Platform.select({
  ios: {
    shadowColor: colors.navy950,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  android: { elevation: 3 },
  default: {},
});
