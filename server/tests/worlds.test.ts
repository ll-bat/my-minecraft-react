import assert from "node:assert/strict";
import {after, before, test} from "node:test";
import request from "supertest";
import {createApp} from "../src/app.js";
import {db} from "../src/db.js";

const app = createApp(db);
const document = (seed: string) => ({version: 9, seed, texture: "dirt", playerPosition: [0, 20, 0], chunks: []});

before(async () => {
    const databaseName = new URL(process.env.DATABASE_URL ?? "").pathname.slice(1);
    if (!databaseName.endsWith("_test")) throw new Error("Backend integration tests require a dedicated database whose name ends with _test");
    await db.world.deleteMany();
    await db.dataPack.deleteMany();
});

after(async () => {
    await db.$disconnect();
});

test("health, world lifecycle, regional saves, and revision safety", async () => {
    await request(app).get("/api/health").expect(200, {ok: true, database: "reachable"});
    const created = await request(app).post("/api/worlds").send({
        id: "integration-world", name: "Integration", seed: "server-test",
        settings: {document: document("server-test")},
        player: {position: [0, 20, 0], positionVersion: 0, state: {}},
    }).expect(201);
    assert.equal(created.body.revision, 0);

    const baseBatch = {
        incarnationId: created.body.incarnationId,
        batchId: "batch-one",
        expectedRevision: 0,
        settings: {document: document("server-test")},
        player: {position: [3, 21, -2], positionVersion: 1, state: {mountedEntityId: null}},
        dimensions: [{dimension: "overworld", state: {worldTime: 25}}],
        chunks: [{dimension: "overworld", chunkX: 0, chunkY: 0, chunkZ: 0, revision: 1, data: {snapshot: ["0,0,0", [], []]}}],
        entities: [{entityId: "overworld:animal:1", dimension: "overworld", chunkX: 0, chunkZ: 0, generated: true, deleted: true, state: null}],
        exploredColumns: [{dimension: "overworld", chunkX: 0, chunkZ: 0}],
        discoveredBiomes: [{dimension: "overworld", biomeId: "plains"}],
        discoveredStructures: [], markers: [], deletedMarkerIds: [],
    };
    const saved = await request(app).patch("/api/worlds/integration-world/autosave").send(baseBatch).expect(200);
    assert.equal(saved.body.revision, 1);
    const retry = await request(app).patch("/api/worlds/integration-world/autosave").send(baseBatch).expect(200);
    assert.equal(retry.body.duplicate, true);
    await request(app).patch("/api/worlds/integration-world/autosave").send({...baseBatch, batchId: "stale"}).expect(409);

    const region = await request(app).get("/api/worlds/integration-world/regions").query({dimension: "overworld", minX: -1, maxX: 1, minZ: -1, maxZ: 1}).expect(200);
    assert.equal(region.body.chunks.length, 1);
    assert.equal(region.body.chunks[0].data.snapshot[0], "0,0,0");
    assert.equal(region.body.entities[0].deleted, true);

    await request(app).patch("/api/worlds/integration-world/player").send({incarnationId: created.body.incarnationId, position: [8, 22, 9], positionVersion: 3}).expect(200);
    await request(app).patch("/api/worlds/integration-world/player").send({incarnationId: created.body.incarnationId, position: [1, 1, 1], positionVersion: 2}).expect(200);
    const loaded = await request(app).get("/api/worlds/integration-world").expect(200);
    assert.deepEqual(loaded.body.player.position, [8, 22, 9]);
});

test("duplicate, export, import, reset, and cascade deletion preserve semantics", async () => {
    const archive = await request(app).get("/api/worlds/integration-world/export").expect(200);
    assert.equal(archive.body.format, "minecraft-react-database-export");
    assert.equal(archive.body.records.chunks.length, 1);

    await request(app).post("/api/worlds/integration-world/duplicate").send({id: "duplicated-world"}).expect(201);
    const duplicateRegion = await request(app).get("/api/worlds/duplicated-world/regions").query({dimension: "overworld", minX: 0, maxX: 0, minZ: 0, maxZ: 0}).expect(200);
    assert.equal(duplicateRegion.body.chunks.length, 1);

    await request(app).post("/api/worlds/import").send({...archive.body, newId: "imported-world", meta: {...archive.body.meta, name: "Imported"}}).expect(201);
    const imported = await request(app).get("/api/worlds/imported-world").expect(200);
    assert.deepEqual(imported.body.player.position, [8, 22, 9]);

    const beforeReset = imported.body.world.incarnationId;
    const reset = await request(app).post("/api/worlds/imported-world/reset").send({
        seed: "fresh-seed", settings: {document: document("fresh-seed")},
        player: {position: [0, 30, 0], positionVersion: 4, state: {}},
    }).expect(200);
    assert.notEqual(reset.body.incarnationId, beforeReset);
    await request(app).patch("/api/worlds/imported-world/player").send({incarnationId: beforeReset, position: [0, 0, 0], positionVersion: 99}).expect(409);

    await request(app).delete("/api/worlds/duplicated-world").expect(200);
    await request(app).get("/api/worlds/duplicated-world").expect(404);
});

test("legacy browser documents are converted into database records", async () => {
    const legacy = {
        ...document("legacy-seed"),
        chunks: [["0,0,0", [], []]],
        exploredColumns: ["overworld:0,0"],
        discoveredBiomes: ["overworld:plains"],
        markers: [{id: "home", dimension: "overworld", name: "Home", color: "#ffffff", position: [0, 20, 0]}],
        entities: [{id: "overworld:placed:boat", type: "boat", position: [1, 20, 1]}],
        dimension: "overworld",
        dimensionSnapshots: [["dream_grove", {...document("legacy-seed:dream"), chunks: [["1,0,1", [], []]], entities: []}]],
    };
    await request(app).post("/api/worlds/import").send({
        format: "minecraft-react-export", version: 1, newId: "legacy-world",
        meta: {name: "Legacy", seed: "legacy-seed"}, document: legacy,
    }).expect(201);
    const loaded = await request(app).get("/api/worlds/legacy-world").expect(200);
    assert.equal(loaded.body.world.settings.document.seed, "legacy-seed");
    assert.equal(loaded.body.markers[0].id, "home");
    const grove = await request(app).get("/api/worlds/legacy-world/regions").query({dimension: "dream_grove", minX: 1, maxX: 1, minZ: 1, maxZ: 1}).expect(200);
    assert.equal(grove.body.chunks[0].data.snapshot[0], "1,0,1");
});
