// Prefab ids known to the registry (kept separate so manifests can be validated without three.js).
export const PREFAB_IDS = [
  "floor_wood", "wall_back_window", "wall_left", "window_view", "rug_round",
  "desk", "desk_chair", "desk_lamp", "armchair", "floor_lamp", "side_table_books",
  "bookshelf_tall", "bookshelf_low", "tea_cart",
  "plant_floor", "plant_sill", "plant_monstera", "plant_hanging",
] as const;
export type PrefabId = (typeof PREFAB_IDS)[number];
