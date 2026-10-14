import {applyRemoteChunks, buildAutosavePayload, markDirtyPositions, persistenceChunkKey} from "./remoteWorld";

const state = () => ({
    seed: "remote-test", worldUid: "remote", worldName: "Remote", worldCreatedAt: 1,
    texture: "dirt", playerPosition: [0, 20, 0], chunks: new Map([["0,0,0", new Map()]]),
    generatedColumns: new Set(), fluidLevels: new Map(), inventory: [], survivalInventory: [],
    selectedHotbar: 0, gameMode: "survival", renderDistance: 4, drops: [], playerCrafting: [],
    tableCrafting: [], blockEntities: new Map(), blockStates: new Map(), scheduledUpdates: [],
    worldTime: 0, dimension: "overworld", dimensionSnapshots: new Map(), exploredColumns: new Set(),
    discoveredBiomes: new Set(), markers: [], discoveredStructures: [], goals: {}, gameRules: {},
    enabledPacks: [], entities: [], spawnedCreatureGroups: new Set(), dirtyChunks: new Map([[persistenceChunkKey("overworld", "0,0,0"), 2]]),
    entityTombstones: new Map([["overworld|bird:1", {entityId: "bird:1", dimension: "overworld", chunkX: 0, chunkZ: 0, generated: true, deleted: true, state: null}]]),
    persistenceIncarnationId: "incarnation", persistenceRevision: 4,
    remoteAuthoritativeChunks: new Set(), blockLight: new Map(),
});

test("dirty positions use dimension-qualified chunk keys", () => {
    const dirty = markDirtyPositions(new Map(), "dream_grove", [[17, 1, -1]]);
    expect(dirty.get("dream_grove|1,0,-1")).toBe(1);
});

test("autosave keeps an explicit empty chunk and entity deletion tombstone", () => {
    const payload = buildAutosavePayload(state(), "batch", 3);
    expect(payload.chunks[0].data.snapshot).toEqual(["0,0,0", [], []]);
    expect(payload.entities).toContainEqual(expect.objectContaining({entityId: "bird:1", deleted: true}));
});

test("remote empty chunks remain present and authoritative", () => {
    const current = state();
    current.chunks = new Map();
    const merged = applyRemoteChunks(current, "overworld", [{chunkX: 0, chunkY: 0, chunkZ: 0, data: {snapshot: ["0,0,0", [], []]}}]);
    expect(merged.chunks.has("0,0,0")).toBe(true);
    expect(merged.chunks.get("0,0,0").size).toBe(0);
    expect(merged.remoteAuthoritativeChunks.has("overworld|0,0,0")).toBe(true);
});

test("remote entity tombstones remain available to terrain spawning", () => {
    const current = state();
    const merged = applyRemoteChunks(current, "overworld", [], [{entityId: "bird:1", deleted: true}]);
    expect(merged.deletedEntityIds.has("bird:1")).toBe(true);
});

test("regional entity merges remove duplicate persistent IDs", () => {
    const current = state();
    const sheep = {id: "sheep:0,0:1:day", type: "sheep", position: [1, 2, 3]};
    current.entities = [sheep, {...sheep}];
    const merged = applyRemoteChunks(current, "overworld", [], []);
    expect(merged.entities.map((entity) => entity.id)).toEqual([sheep.id]);
});
