import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Expo app config. Native secrets (Google Maps keys, EAS project id) come from the environment so
 * nothing sensitive is committed. See .env.example.
 */
const NAVY = "#07111F";

const locationWhenInUse =
  "ShiftShield uses your location only while you are clocked in to a shift, so the employer can confirm you are on site. It is never tracked in the background otherwise.";
const locationAlways =
  "ShiftShield shares your location with the employer only from clock-in to clock-out of an active shift, even if the app is in the background. Tracking stops the moment you clock out.";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "ShiftShield",
  slug: "shiftshield",
  version: "0.1.0",
  orientation: "portrait",
  scheme: "shiftshield",
  userInterfaceStyle: "dark",
  icon: "./assets/images/icon.png",
  backgroundColor: NAVY,
  ios: {
    bundleIdentifier: "com.shiftshield.app",
    supportsTablet: false,
    infoPlist: {
      NSLocationWhenInUseUsageDescription: locationWhenInUse,
      NSLocationAlwaysAndWhenInUseUsageDescription: locationAlways,
      NSCameraUsageDescription: "Take photos of your license and incident reports.",
      NSPhotoLibraryUsageDescription: "Upload photos of your license and incident reports.",
      UIBackgroundModes: ["location"],
      ITSAppUsesNonExemptEncryption: false,
    },
    config: { googleMapsApiKey: process.env.GOOGLE_MAPS_IOS_API_KEY },
  },
  android: {
    package: "com.shiftshield.app",
    adaptiveIcon: {
      backgroundColor: NAVY,
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    permissions: [
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "FOREGROUND_SERVICE",
      "FOREGROUND_SERVICE_LOCATION",
    ],
    config: { googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY } },
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        backgroundColor: NAVY,
        image: "./assets/images/splash-icon.png",
        imageWidth: 120,
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission: locationWhenInUse,
        locationAlwaysAndWhenInUsePermission: locationAlways,
        locationAlwaysPermission: locationAlways,
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    "expo-font",
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : undefined,
  },
  updates: process.env.EAS_PROJECT_ID
    ? { url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID}` }
    : undefined,
  runtimeVersion: { policy: "appVersion" },
});
