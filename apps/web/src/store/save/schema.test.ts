import { describe, it, expect } from "vitest";
import { inspectRaw, migrateSave, sanitizeSave, SAVE_VERSION, type SanitizeContext } from "./schema";
import { DEFAULT_CONFIG, initialState } from "@/systems/productivity/pomodoro";
import { begin, type Story } from "@/systems/story/engine";
import storyJson from "@content/story/the-unfinished-page.json";
import first from "./__fixtures__/v0-first-release.json";
import latest from "./__fixtures__/v0-latest.json";
import corrupt from "./__fixtures__/v0-partially-corrupt.json";
import future from "./__fixtures__/future-v99.json";

const STORY = storyJson as Story;
const ctx: SanitizeContext = {
  storyId: STORY.id, isStoryNode: (id) => !!STORY.nodes[id],
  defaults: {
    config: DEFAULT_CONFIG, timer: initialState(), tasks: [], chat: [], story: begin(STORY),
    settings: { reducedMotion: "system", renderMode: "3d", characterId: "girl-one", rainVolume: 0, roomVolume: 0, musicVolume: 0.6,
      chatProvider: "mock", ollamaUrl: "http://localhost:11434", ollamaModel: "llama3.2", notifications: false },
  },
};

describe("save schema: legacy v0 migration", () => {
  it("first-release save keeps every task, chat line, story step and running timer", () => {
    const { save, issues } = migrateSave(first.state, 0, ctx);
    expect(issues).toEqual([]);
    expect(save.tasks).toEqual(first.state.tasks);
    expect(save.chat).toEqual(first.state.chat);
    expect(save.story).toEqual(first.state.story);
    expect(save.timer).toEqual(first.state.timer); // running session survives with its absolute end time
    expect(save.config).toEqual(first.state.config);
    // settings that did not exist yet get defaults; existing ones are kept
    expect(save.settings.rainVolume).toBe(0.4);
    expect(save.settings.renderMode).toBe("3d");
    expect(save.settings.characterId).toBe("girl-one");
  });

  it("latest v0 save is preserved exactly", () => {
    const { save, issues } = migrateSave(latest.state, 0, ctx);
    expect(issues).toEqual([]);
    expect(save).toEqual(latest.state);
  });

  it("partially corrupt save keeps the valid parts and reports the rest", () => {
    const { save, issues } = migrateSave(corrupt.state, 0, ctx);
    expect(save.tasks).toEqual([{ id: "ok-1", title: "Keep me", done: false, createdAt: 1 }]);
    expect(save.config).toEqual({ ...DEFAULT_CONFIG, shortBreakMin: 5, longBreakEvery: 4 });
    expect(save.timer.running).toBe(false);
    expect(save.timer.phase).toBe("focus");
    expect(save.timer.completedFocus).toBe(2);
    expect(save.chat).toEqual([]);
    expect(save.story).toEqual(begin(STORY));
    expect(save.settings.characterId).toBe("girl-five");
    expect(save.settings.musicVolume).toBe(0.3);
    expect(save.settings.rainVolume).toBe(0);
    expect(save.settings.ollamaUrl).toBe("http://localhost:11434");
    expect(save.settings.notifications).toBe(false);
    expect(issues.length).toBeGreaterThan(8);
  });

  it("future-version save is read best-effort without crashing", () => {
    const { save } = migrateSave(future.state, 99, ctx);
    expect(save.tasks[0]).toEqual({ id: "x", title: "From the future", done: false, createdAt: 1 });
    expect(save.timer.completedFocus).toBe(40);
    expect(save.settings.renderMode).toBe("3d"); // unknown mode falls back
  });

  it("missing or garbage state gives defaults", () => {
    expect(sanitizeSave(undefined, ctx).save).toEqual(ctx.defaults);
    expect(sanitizeSave("nope", ctx).save).toEqual(ctx.defaults);
  });

  it("migration is idempotent for every fixture", () => {
    for (const f of [first, latest, corrupt, future]) {
      const once = migrateSave(f.state, f.version, ctx).save;
      const twice = migrateSave(once, SAVE_VERSION, ctx);
      expect(twice.save).toEqual(once);
      expect(twice.issues).toEqual([]);
    }
  });
});

describe("inspectRaw", () => {
  it("classifies stored strings", () => {
    expect(inspectRaw(null).kind).toBe("empty");
    expect(inspectRaw(JSON.stringify(first)).kind).toBe("legacy");
    expect(inspectRaw(JSON.stringify({ state: {} })).kind).toBe("legacy"); // no version field = v0
    expect(inspectRaw(JSON.stringify({ state: {}, version: SAVE_VERSION })).kind).toBe("current"); // M0 dev envelope
    expect(inspectRaw(JSON.stringify({ state: { __schema: SAVE_VERSION }, version: 0 })).kind).toBe("current");
    expect(inspectRaw(JSON.stringify({ state: { __schema: SAVE_VERSION + 1 }, version: 0 }))).toEqual({ kind: "future", version: SAVE_VERSION + 1 });
    expect(inspectRaw(JSON.stringify({ state: { __schema: "one" }, version: 0 })).kind).toBe("malformed");
    expect(inspectRaw(JSON.stringify(future))).toEqual({ kind: "future", version: 99 });
    expect(inspectRaw("{not json").kind).toBe("malformed");
    expect(inspectRaw(JSON.stringify({ version: 1 })).kind).toBe("malformed");
    expect(inspectRaw(JSON.stringify({ state: {}, version: -1 })).kind).toBe("malformed");
  });
});
