export interface LatLng {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_MI = 3958.8;

/** Great-circle distance in miles. */
export function distanceMiles(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(h));
}

export function distanceMeters(a: LatLng, b: LatLng): number {
  return distanceMiles(a, b) * 1609.344;
}

/** Region that fits every point with some padding. */
export function regionFor(points: LatLng[], paddingFactor = 1.4) {
  if (points.length === 0) {
    return { latitude: 32.7767, longitude: -96.797, latitudeDelta: 0.5, longitudeDelta: 0.5 };
  }
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.05, (maxLat - minLat) * paddingFactor),
    longitudeDelta: Math.max(0.05, (maxLng - minLng) * paddingFactor),
  };
}

/** Google Maps directions deep link that works on both platforms. */
export function directionsUrl(p: LatLng, label?: string): string {
  const q = `${p.latitude},${p.longitude}`;
  const l = label ? `&destination_place_id=&query=${encodeURIComponent(label)}` : "";
  return `https://www.google.com/maps/dir/?api=1&destination=${q}${l}`;
}
