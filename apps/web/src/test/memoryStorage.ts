import type { StateStorage } from "zustand/middleware";
/** In-memory StateStorage for tests; records every key touched. */
export function memoryStorage(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  const touched = new Set<string>();
  const storage: StateStorage = {
    getItem: async (k) => { touched.add(k); return data.get(k) ?? null; },
    setItem: async (k, v) => { touched.add(k); data.set(k, v); },
    removeItem: async (k) => { touched.add(k); data.delete(k); },
  };
  return { storage, data, touched };
}
