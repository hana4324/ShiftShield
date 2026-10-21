import Constants from "expo-constants";
import { Platform } from "react-native";

/** EXPO_PUBLIC_DEMO_MODE=true shows "Demo as Officer / Employer" on the Welcome screen with no signup. */
export const DEMO_MODE = (process.env.EXPO_PUBLIC_DEMO_MODE ?? "true").toLowerCase() === "true";

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** True when running inside the Expo Go client (store build), where some native modules are limited. */
export const IS_EXPO_GO = Constants.executionEnvironment === "storeClient";

/**
 * Google provider on both platforms per spec. Expo Go on iOS does not ship the Google Maps SDK,
 * so we fall back to Apple Maps there and use Google everywhere else (dev builds, EAS builds, Android).
 */
export const USE_GOOGLE_MAPS_PROVIDER = !(IS_EXPO_GO && Platform.OS === "ios");

export const APP_VERSION = Constants.expoConfig?.version ?? "0.0.0";
