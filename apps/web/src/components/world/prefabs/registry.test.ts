// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import { buildPrefab, REGISTERED_PREFABS } from "./registry";
import { makeKit } from "@/components/room3d/kit";
import { paletteFor } from "@/components/room3d/timeOfDay";

beforeAll(() => { HTMLCanvasElement.prototype.getContext = (() => null) as never; });

describe("prefab contract", () => {
  it.each(REGISTERED_PREFABS)("%s returns a container at the local origin (so manifest placement can't move its content)", (id) => {
    const kit = makeKit(new THREE.Group());
    const { object } = buildPrefab(id, { kit, pal: paletteFor(12), lowQuality: false });
    expect(object.position.toArray()).toEqual([0, 0, 0]);
    expect(object.rotation.y).toBe(0);
  });
});
