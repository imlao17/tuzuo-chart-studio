/**
 * GeoJSON map registration for the map-family templates.
 *
 * Map data ships as static files under public/geo (world.json from the
 * Apache ECharts project's MIT-licensed test data; china.json from
 * DataV.GeoAtlas). Registration happens lazily in the browser, right before
 * a map template first renders, so non-map templates never fetch it.
 */

const loaded = new Set<string>();
const pending = new Map<string, Promise<void>>();

export type GeoMapName = "world" | "china";

export function isGeoMapRegistered(name: GeoMapName): boolean {
  return loaded.has(name);
}

export async function ensureGeoMap(name: GeoMapName): Promise<void> {
  if (loaded.has(name)) return;
  const inflight = pending.get(name);
  if (inflight) return inflight;
  const task = (async () => {
    const { registerMap } = await import("echarts");
    const response = await fetch(`/geo/${name}.json`);
    if (!response.ok) {
      throw new Error(`Unable to load map data: /geo/${name}.json`);
    }
    registerMap(name, await response.json());
    loaded.add(name);
  })();
  pending.set(name, task);
  try {
    await task;
  } finally {
    pending.delete(name);
  }
}
