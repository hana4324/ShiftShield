import type { GeoJsonPoint, LocationPingRow } from "@shiftshield/shared";
import { fmtTime } from "@/lib/admin/format";
import { parseGeoPoint, staticMapUrl } from "@/lib/admin/geo";
import { serverEnv } from "@/lib/env";

/**
 * GPS record for one assignment: a Google Static Map when NEXT_PUBLIC_GOOGLE_MAPS_WEB_KEY is
 * set, otherwise a plain SVG plot; plus the ping list.
 */
export function GpsTrail({
  pings,
  site,
  clockIn,
  clockOut,
}: {
  pings: LocationPingRow[];
  site?: { geo: string | null; radiusM: number | null; name?: string } | null;
  clockIn?: string | null;
  clockOut?: string | null;
}) {
  const points = pings
    .map((p) => ({ ping: p, point: parseGeoPoint(p.geo) }))
    .filter((p): p is { ping: LocationPingRow; point: GeoJsonPoint } => p.point !== null);
  const sitePoint = site ? parseGeoPoint(site.geo) : null;
  const inPoint = parseGeoPoint(clockIn);
  const outPoint = parseGeoPoint(clockOut);
  const trail = [inPoint, ...points.map((p) => p.point), outPoint].filter((p): p is GeoJsonPoint => p !== null);
  const key = serverEnv.googleMapsWebKey;

  return (
    <div className="space-y-3">
      {trail.length === 0 && !sitePoint ? (
        <p className="text-sm text-navy-950/60">No location data recorded for this assignment.</p>
      ) : key ? (
        // Static Maps image; signed by the API key, nothing to optimize.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={staticMapUrl(key, trail, { site: sitePoint, radiusM: site?.radiusM ?? null })}
          alt={`Map of ${trail.length} GPS points${site?.name ? ` around ${site.name}` : ""}`}
          width={640}
          height={400}
          className="w-full rounded-xl bg-slate-50 ring-1 ring-navy-950/10"
        />
      ) : (
        <SvgPlot trail={trail} site={sitePoint} radiusM={site?.radiusM ?? null} />
      )}
      <p className="text-xs text-navy-950/60">
        {points.length} ping{points.length === 1 ? "" : "s"}
        {inPoint ? " / clock-in" : ""}
        {outPoint ? " / clock-out" : ""}
        {sitePoint ? ` / site geofence ${site?.radiusM ?? "?"} m` : ""}
        {!key ? " / set NEXT_PUBLIC_GOOGLE_MAPS_WEB_KEY for a street map" : ""}
      </p>
      {points.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-blue-700">Ping list</summary>
          <div className="mt-2 max-h-64 overflow-auto rounded-xl bg-slate-50 p-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-steel-400">
                  <th className="px-2 py-1">Time (CT)</th>
                  <th className="px-2 py-1">Lat</th>
                  <th className="px-2 py-1">Lng</th>
                  <th className="px-2 py-1">Accuracy</th>
                  <th className="px-2 py-1">To site</th>
                </tr>
              </thead>
              <tbody>
                {points.map(({ ping, point }) => (
                  <tr key={ping.id} className="font-mono">
                    <td className="px-2 py-1">{fmtTime(ping.recorded_at)}</td>
                    <td className="px-2 py-1">{point.lat.toFixed(5)}</td>
                    <td className="px-2 py-1">{point.lng.toFixed(5)}</td>
                    <td className="px-2 py-1">{ping.accuracy_m !== null ? `${Math.round(ping.accuracy_m)} m` : "-"}</td>
                    <td className="px-2 py-1">{sitePoint ? `${Math.round(distanceM(point, sitePoint))} m` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </div>
  );
}

function distanceM(a: GeoJsonPoint, b: GeoJsonPoint): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Equirectangular plot of the trail relative to the site; no external services. */
function SvgPlot({ trail, site, radiusM }: { trail: GeoJsonPoint[]; site: GeoJsonPoint | null; radiusM: number | null }) {
  const all = [...trail, ...(site ? [site] : [])];
  const W = 640;
  const H = 400;
  const PAD = 32;
  const lat0 = all.reduce((s, p) => s + p.lat, 0) / all.length;
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  const xy = (p: GeoJsonPoint) => ({ x: (p.lng - (site ?? all[0]!).lng) * mPerDegLng, y: -(p.lat - (site ?? all[0]!).lat) * mPerDegLat });
  const pts = all.map(xy);
  const r = radiusM ?? 0;
  const minX = Math.min(...pts.map((p) => p.x), -r);
  const maxX = Math.max(...pts.map((p) => p.x), r);
  const minY = Math.min(...pts.map((p) => p.y), -r);
  const maxY = Math.max(...pts.map((p) => p.y), r);
  const span = Math.max(maxX - minX, maxY - minY, 50);
  const scale = (Math.min(W, H) - PAD * 2) / span;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const toSvg = (p: GeoJsonPoint) => {
    const q = xy(p);
    return { x: W / 2 + (q.x - cx) * scale, y: H / 2 + (q.y - cy) * scale };
  };
  const trailSvg = trail.map(toSvg);
  const siteSvg = site ? toSvg(site) : null;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Plot of ${trail.length} GPS points relative to the site`}
      className="w-full rounded-xl bg-slate-50 ring-1 ring-navy-950/10"
    >
      {siteSvg && r > 0 ? (
        <circle cx={siteSvg.x} cy={siteSvg.y} r={r * scale} fill="rgb(30 99 233 / 0.08)" stroke="#1e63e9" strokeDasharray="4 4" />
      ) : null}
      {siteSvg ? <circle cx={siteSvg.x} cy={siteSvg.y} r={6} fill="#07111f" /> : null}
      {trailSvg.length > 1 ? (
        <polyline points={trailSvg.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#1e63e9" strokeWidth={2.5} strokeLinejoin="round" />
      ) : null}
      {trailSvg.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={i === 0 || i === trailSvg.length - 1 ? 5 : 3}
          fill={i === 0 ? "#22c55e" : i === trailSvg.length - 1 ? "#ef4444" : "#1e63e9"}
        />
      ))}
      <text x={12} y={H - 12} fontSize={12} fill="#9a9fa6">
        {`scale: ${Math.round(100 / scale)} m per 100 px`}
      </text>
    </svg>
  );
}
