// Distances between localities. Pure; Node and Workers.
import type { Geo, Locality, LocalityKind } from '../schema/index.ts';

const EARTH_RADIUS_M = 6_371_008.8; // mean Earth radius (IUGG)

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres between two WGS84 points (haversine, CONTRACTS §1 "Geo"). */
export function haversineM(a: Geo, b: Geo): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface NearestOptions {
  /** Which kinds may be returned. Default: `locality` only, so a page never "recommends" a landmark by accident. */
  kinds?: readonly LocalityKind[];
}

export interface NearestResult {
  locality_id: string;
  /** Whole metres. */
  distance_m: number;
}

/**
 * The `n` localities closest to `geo`, closest first. Ties break on id, so the order does not depend on the input
 * order. Entries with non-finite coordinates are skipped. Fewer than `n` come back when fewer qualify.
 */
export function nearest(
  geo: Geo,
  localities: readonly Locality[],
  n: number,
  options: NearestOptions = {},
): NearestResult[] {
  const count = Math.trunc(n);
  if (!(count > 0) || !Number.isFinite(geo.lat) || !Number.isFinite(geo.lng)) return [];
  const kinds = options.kinds ?? ['locality'];
  return localities
    .filter((l) => kinds.includes(l.kind) && Number.isFinite(l.geo.lat) && Number.isFinite(l.geo.lng))
    .map((l) => ({ locality_id: l.id, exact: haversineM(geo, l.geo) }))
    .sort(
      (p, q) =>
        p.exact - q.exact || (p.locality_id < q.locality_id ? -1 : p.locality_id > q.locality_id ? 1 : 0),
    )
    .slice(0, count)
    .map((p) => ({ locality_id: p.locality_id, distance_m: Math.round(p.exact) }));
}
