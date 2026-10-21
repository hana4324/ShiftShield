import type { GeoJsonPoint } from "@shiftshield/shared";

/**
 * PostgREST returns `geography(Point)` columns as EWKB hex (e.g. "0101000020E6100000<x><y>").
 * Decode it locally instead of calling `geo_to_json` once per row.
 */
export function parseGeoPoint(value: string | null | undefined): GeoJsonPoint | null {
  if (!value || typeof value !== "string") return null;
  const hex = value.trim();
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length < 42) return tryGeoJson(value);
  try {
    const buf = Buffer.from(hex, "hex");
    const little = buf.readUInt8(0) === 1;
    const type = little ? buf.readUInt32LE(1) : buf.readUInt32BE(1);
    const hasSrid = (type & 0x20000000) !== 0;
    const baseType = type & 0xff;
    if (baseType !== 1) return null; // not a Point
    let offset = 5 + (hasSrid ? 4 : 0);
    const x = little ? buf.readDoubleLE(offset) : buf.readDoubleBE(offset);
    offset += 8;
    const y = little ? buf.readDoubleLE(offset) : buf.readDoubleBE(offset);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { lat: y, lng: x };
  } catch {
    return null;
  }
}

/** Some PostgREST configs serialize geography as GeoJSON; accept that too. */
function tryGeoJson(value: string): GeoJsonPoint | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      parsed &&
      typeof parsed === "object" &&
      "coordinates" in parsed &&
      Array.isArray((parsed as { coordinates: unknown }).coordinates)
    ) {
      const [lng, lat] = (parsed as { coordinates: number[] }).coordinates;
      if (typeof lat === "number" && typeof lng === "number") return { lat, lng };
    }
  } catch {
    /* not JSON */
  }
  return null;
}

/** Google Static Maps URL for a trail (path + start/end markers + optional site marker). */
export function staticMapUrl(
  key: string,
  points: GeoJsonPoint[],
  opts: { site?: GeoJsonPoint | null; radiusM?: number | null } = {},
): string {
  const p = new URLSearchParams();
  p.set("size", "640x400");
  p.set("scale", "2");
  p.set("maptype", "roadmap");
  if (points.length > 1) {
    p.append(
      "path",
      `color:0x1e63e9ff|weight:3|${points.map((pt) => `${pt.lat.toFixed(5)},${pt.lng.toFixed(5)}`).join("|")}`,
    );
  }
  if (points.length > 0) {
    const first = points[0]!;
    const last = points[points.length - 1]!;
    p.append("markers", `color:green|label:S|${first.lat.toFixed(5)},${first.lng.toFixed(5)}`);
    if (points.length > 1)
      p.append("markers", `color:red|label:E|${last.lat.toFixed(5)},${last.lng.toFixed(5)}`);
  }
  if (opts.site) {
    p.append("markers", `color:0x07111f|label:P|${opts.site.lat.toFixed(5)},${opts.site.lng.toFixed(5)}`);
    if (opts.radiusM) {
      p.append("path", `fillcolor:0x1e63e933|color:0x1e63e9aa|weight:1|${circlePath(opts.site, opts.radiusM)}`);
    }
  }
  if (points.length === 0 && !opts.site) p.set("center", "32.7767,-96.7970");
  if (points.length === 0 && !opts.site) p.set("zoom", "11");
  p.set("key", key);
  return `https://maps.googleapis.com/maps/api/staticmap?${p.toString()}`;
}

function circlePath(center: GeoJsonPoint, radiusM: number): string {
  const pts: string[] = [];
  const R = 6371000;
  const dLat = radiusM / R;
  const dLng = radiusM / (R * Math.cos((center.lat * Math.PI) / 180));
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * 2 * Math.PI;
    const lat = center.lat + (dLat * Math.sin(a) * 180) / Math.PI;
    const lng = center.lng + (dLng * Math.cos(a) * 180) / Math.PI;
    pts.push(`${lat.toFixed(5)},${lng.toFixed(5)}`);
  }
  return pts.join("|");
}
