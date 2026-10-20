import { describe, it, expect } from "vitest";
import { validateLocation, REQUIRED_ANCHORS, type LocationManifest } from "./schema";
import { PREFAB_IDS } from "@/components/world/prefabs/ids";
import { REGISTERED_PREFABS } from "@/components/world/prefabs/registry";
import study from "@content/locations/study.json";

const clone = () => JSON.parse(JSON.stringify(study)) as LocationManifest;

describe("study location manifest", () => {
  it("is valid against the real prefab registry", () => {
    expect(validateLocation(study, PREFAB_IDS)).toEqual([]);
  });
  it("registry builds every listed prefab id (and nothing unlisted)", () => {
    expect([...REGISTERED_PREFABS].sort()).toEqual([...PREFAB_IDS].sort());
  });
  it("has the four activity anchors with sensible poses", () => {
    for (const id of REQUIRED_ANCHORS) expect(study.anchors[id]).toBeTruthy();
    expect(study.anchors.desk.pose).toBe("sit_type");
    expect(study.anchors.reading.pose).toBe("sit_relax");
  });
  it("every asset entry declares a license", () => {
    for (const a of study.assets) expect(a.license.length).toBeGreaterThan(3);
  });
});

describe("validateLocation catches mistakes", () => {
  it("missing anchor, unknown prefab, out-of-bounds prop, bad camera, missing license", () => {
    const m = clone();
    delete (m.anchors as Partial<LocationManifest["anchors"]>).tea;
    m.props.push({ prefab: "spaceship", pos: [0, 0, 0], layer: "props" });
    m.props.push({ prefab: "desk", pos: [9, 0, 0], layer: "props" });
    m.camera.overview.fov = 70;
    m.assets.push({ id: "x", kind: "file", status: "final", license: "" });
    const errs = validateLocation(m, PREFAB_IDS).join("\n");
    expect(errs).toMatch(/anchors.tea: missing/);
    expect(errs).toMatch(/unknown prefab "spaceship"/);
    expect(errs).toMatch(/outside bounds/);
    expect(errs).toMatch(/fov/);
    expect(errs).toMatch(/needs src/);
    expect(errs).toMatch(/license required/);
  });
  it("anchors that overlap are rejected", () => {
    const m = clone();
    m.anchors.window.pos = [...m.anchors.desk.pos];
    expect(validateLocation(m, PREFAB_IDS).join()).toMatch(/closer than/);
  });
});
