import "fake-indexeddb/auto";
import { describe, it, expect, vi } from "vitest";
import first from "./save/__fixtures__/v0-first-release.json";

describe("useGame persistence (IndexedDB, end to end)", () => {
  it("loads a legacy v0 save, keeps the user's data, upgrades to v1 and leaves a backup", async () => {
    const { idbStorage } = await import("@/systems/persistence/idbStorage");
    await idbStorage.setItem("olh-save-v1", JSON.stringify(first));
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { useGame } = await import("./useGame");
    await useGame.persist.rehydrate();

    const s = useGame.getState();
    expect(s.tasks.map((t) => t.title)).toEqual(["Read chapter 3", "Laundry", "Reply to Aye's message"]);
    expect(s.timer.completedFocus).toBe(3);
    expect(s.story.nodeId).toBe("s4b");
    expect(s.settings.rainVolume).toBe(0.4);

    s.taskAction({ type: "add", title: "New after upgrade" });
    await new Promise((r) => setTimeout(r, 20));
    const stored = JSON.parse((await idbStorage.getItem("olh-save-v1"))!);
    expect(stored.version).toBe(1);
    expect(stored.state.tasks).toHaveLength(4);

    const index = JSON.parse((await idbStorage.getItem("olh-save-v1.backups"))!);
    expect(index).toHaveLength(1);
    expect(await idbStorage.getItem(index[0].key)).toBe(JSON.stringify(first));
  });
});
