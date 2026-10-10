import {ACTIVE_WORLD_KEY, deleteWorldRecord, ensureWorldCatalog, exportWorldRecord, importWorldRecord, readCatalog, upsertWorld} from "./worldCatalog";

describe("world catalog", () => {
    beforeEach(() => window.localStorage.clear());

    test("migrates the single saved world into a catalog", () => {
        window.localStorage.setItem("old", JSON.stringify({version: 6, chunks: []}));
        const result = ensureWorldCatalog("old");
        expect(result.worlds).toHaveLength(1);
        expect(window.localStorage.getItem(ACTIVE_WORLD_KEY)).toBe(result.active);
    });

    test("isolates, exports, imports, and deletes worlds", () => {
        upsertWorld({id: "one", name: "One", seed: "a", createdAt: 1}, JSON.stringify({version: 7, chunks: []}));
        const exported = exportWorldRecord("one");
        expect(importWorldRecord(exported, "two").ok).toBe(true);
        expect(readCatalog()).toHaveLength(2);
        deleteWorldRecord("one");
        expect(readCatalog().map((world) => world.id)).toEqual(["two"]);
    });
});
