import { describe, it, expect, vi } from "vitest";
import { backupRaw, createVersionedStorage, listBackups, restoreBackup, MAX_BACKUPS } from "./recovery";
import { memoryStorage } from "@/test/memoryStorage";
import first from "./__fixtures__/v0-first-release.json";

const KEY = "olh-save-v1";
const legacyRaw = JSON.stringify(first);

describe("versioned storage", () => {
  it("backs up a legacy save byte-for-byte before handing it to the migrator", async () => {
    const { storage, data } = memoryStorage({ [KEY]: legacyRaw });
    const vs = createVersionedStorage(storage, {}, () => 1000);
    expect(await vs.getItem(KEY)).toBe(legacyRaw);
    const [b] = await listBackups(storage, KEY);
    expect(b).toMatchObject({ reason: "legacy", fromVersion: 0, createdAt: 1000 });
    expect(data.get(b.key)).toBe(legacyRaw);
    await vs.getItem(KEY); // second read in the same session: no duplicate backup
    expect(await listBackups(storage, KEY)).toHaveLength(1);
  });

  it("does not back up current-version saves", async () => {
    const { storage } = memoryStorage({ [KEY]: JSON.stringify({ state: {}, version: 1 }) });
    await createVersionedStorage(storage).getItem(KEY);
    expect(await listBackups(storage, KEY)).toEqual([]);
  });

  it("hides malformed data from zustand but keeps a backup", async () => {
    const { storage, data } = memoryStorage({ [KEY]: "{broken" });
    expect(await createVersionedStorage(storage).getItem(KEY)).toBeNull();
    const [b] = await listBackups(storage, KEY);
    expect(b.reason).toBe("malformed");
    expect(data.get(b.key)).toBe("{broken");
  });

  it("goes read-only if the backup cannot be written", async () => {
    const { storage, data } = memoryStorage({ [KEY]: legacyRaw });
    const failing = { ...storage, setItem: vi.fn(async () => { throw new Error("quota"); }) };
    const vs = createVersionedStorage(failing);
    expect(await vs.getItem(KEY)).toBeNull();
    await vs.setItem(KEY, "overwrite attempt");
    await vs.removeItem(KEY);
    expect(data.get(KEY)).toBe(legacyRaw);
  });
});

describe("backups", () => {
  it("keeps at most MAX_BACKUPS, dropping the oldest", async () => {
    const { storage, data } = memoryStorage();
    for (let i = 0; i < MAX_BACKUPS + 2; i++) await backupRaw(storage, KEY, `raw${i}`, "legacy", 0, i);
    const list = await listBackups(storage, KEY);
    expect(list).toHaveLength(MAX_BACKUPS);
    expect(list[0].createdAt).toBe(2);
    expect([...data.keys()].filter((k) => k.includes(".backup.")).length).toBe(MAX_BACKUPS);
  });

  it("restore puts the backup back and backs up the current save first", async () => {
    const { storage, data } = memoryStorage({ [KEY]: "current" });
    const key = await backupRaw(storage, KEY, legacyRaw, "legacy", 0, 1);
    expect(await restoreBackup(storage, KEY, key, 2)).toBe(true);
    expect(data.get(KEY)).toBe(legacyRaw);
    const manual = (await listBackups(storage, KEY)).find((b) => b.reason === "manual")!;
    expect(data.get(manual.key)).toBe("current");
    expect(await restoreBackup(storage, KEY, "nope")).toBe(false);
  });
});
