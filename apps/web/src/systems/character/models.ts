import { asset } from "@/lib/asset";
// Character model catalog (public/models/manifest.json) + availability checks.
export interface CharacterModel { id: string; name: string; file: string; thumbnail?: string; available?: boolean }
export const PLACEHOLDER_ID = "placeholder";
const BASE = asset("/models");

export function parseManifest(data: unknown): CharacterModel[] {
  const list = (data as { characters?: unknown })?.characters;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  return list.filter((c): c is CharacterModel =>
    !!c && typeof c.id === "string" && typeof c.name === "string" && typeof c.file === "string" && /\.vrm$/i.test(c.file)
    && c.id !== PLACEHOLDER_ID && !seen.has(c.id) && !!seen.add(c.id));
}

/** URL of the model to load, or null for the built-in placeholder. */
export function resolveModelUrl(models: CharacterModel[], id: string): string | null {
  const m = models.find((x) => x.id === id && x.available !== false);
  return m ? `${BASE}/${encodeURIComponent(m.file)}` : null;
}

export const thumbUrl = (m: CharacterModel) => (m.thumbnail ? `${BASE}/${m.thumbnail.split("/").map(encodeURIComponent).join("/")}` : null);

export async function loadModels(): Promise<CharacterModel[]> {
  try {
    const res = await fetch(`${BASE}/manifest.json`, { cache: "no-store" });
    if (!res.ok) return [];
    const models = parseManifest(await res.json());
    return Promise.all(models.map(async (m) => {
      try {
        const r = await fetch(`${BASE}/${encodeURIComponent(m.file)}`, { method: "HEAD", cache: "no-store" });
        return { ...m, available: r.ok && !(r.headers.get("content-type") ?? "").includes("text/html") };
      } catch { return { ...m, available: false }; }
    }));
  } catch { return []; }
}
