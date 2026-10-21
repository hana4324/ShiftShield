import type { ComponentProps, ReactNode } from "react";
import { StyleSheet } from "react-native";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
import { USE_GOOGLE_MAPS_PROVIDER } from "@/lib/env";

type MapProps = ComponentProps<typeof MapView>;

/** Dark-ish Google map styling that matches the navy app chrome. */
const NAVY_STYLE: NonNullable<MapProps["customMapStyle"]> = [
  { elementType: "geometry", stylers: [{ color: "#0f1f3a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9aa3b2" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#07111f" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1b2d4f" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#27406b" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a1730" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

/**
 * MapView with the Google provider on both platforms (falls back to Apple Maps inside Expo Go on iOS,
 * where the Google SDK is not bundled). Children are Markers.
 */
export function ShiftMap({ children, style, ...rest }: MapProps & { children?: ReactNode }) {
  return (
    <MapView
      provider={USE_GOOGLE_MAPS_PROVIDER ? PROVIDER_GOOGLE : undefined}
      customMapStyle={USE_GOOGLE_MAPS_PROVIDER ? NAVY_STYLE : undefined}
      userInterfaceStyle="dark"
      showsCompass={false}
      toolbarEnabled={false}
      style={[styles.map, style]}
      {...rest}
    >
      {children}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});
