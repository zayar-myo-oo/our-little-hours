// Feature flags. `livingWorld` is ON by default since the release (turn off: ?ff=-livingWorld or NEXT_PUBLIC_FF_LIVING_WORLD=0).
// Precedence: URL (?ff=livingWorld or ?ff=-livingWorld) > localStorage "olh-ff" > env NEXT_PUBLIC_FF_LIVING_WORLD > default.
export type FeatureFlag = "livingWorld";
export type Flags = Record<FeatureFlag, boolean>;

export const DEFAULT_FLAGS: Flags = { livingWorld: true };
const ALL = Object.keys(DEFAULT_FLAGS) as FeatureFlag[];
const STORAGE_KEY = "olh-ff";

const truthy = (v: string | undefined) => v === "1" || v === "true";

export function resolveFlags(src: { env?: Partial<Record<FeatureFlag, string | undefined>>; stored?: string | null; search?: string }): Flags {
  const out: Flags = { ...DEFAULT_FLAGS };
  for (const f of ALL) if (src.env?.[f] !== undefined) out[f] = truthy(src.env[f]);
  try {
    const s = src.stored ? JSON.parse(src.stored) : null;
    if (s && typeof s === "object") for (const f of ALL) if (typeof s[f] === "boolean") out[f] = s[f];
  } catch { /* ignore malformed override */ }
  for (const token of new URLSearchParams(src.search ?? "").getAll("ff").flatMap((v) => v.split(","))) {
    const off = token.startsWith("-"), name = (off ? token.slice(1) : token) as FeatureFlag;
    if (ALL.includes(name)) out[name] = !off;
  }
  return out;
}

export function getFlags(): Flags {
  if (typeof window === "undefined") return resolveFlags({ env: { livingWorld: process.env.NEXT_PUBLIC_FF_LIVING_WORLD } });
  let stored: string | null = null;
  try { stored = window.localStorage.getItem(STORAGE_KEY); } catch { /* storage blocked */ }
  return resolveFlags({ env: { livingWorld: process.env.NEXT_PUBLIC_FF_LIVING_WORLD }, stored, search: window.location.search });
}

export const isFeatureEnabled = (flag: FeatureFlag) => getFlags()[flag];
