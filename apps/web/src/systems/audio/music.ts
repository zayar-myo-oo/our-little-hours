import { asset } from "@/lib/asset";
export interface Track { title: string; artist?: string; file: string; license?: string }

/** Loads the user-provided manifest. Returns [] if missing or malformed. */
export async function loadManifest(base = asset("/audio/music")): Promise<Track[]> {
  try {
    const res = await fetch(`${base}/manifest.json`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.tracks) ? data.tracks.filter((t: Track) => t && typeof t.file === "string") : [];
  } catch { return []; }
}

export const nextIndex = (i: number, n: number, dir: 1 | -1 = 1) => (n === 0 ? 0 : (i + dir + n) % n);
