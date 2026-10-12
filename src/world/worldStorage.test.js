jest.mock("nanoid", () => ({nanoid: () => "test-id"}));

import {getBlock} from "./chunks";
import {parseWorldDocument, serializeWorld, WORLD_VERSION} from "./worldStorage";
import {emptyInventory} from "./inventory";
import {createFurnace} from "./furnaces";
import {createChest, scheduleCrop} from "./interactions";

describe("world storage", () => {
    test("round-trips versioned chunk data", () => {
        const state = {
            seed: "storage seed",
            texture: "grass",
            playerPosition: [1, 2, 3],
            generatedColumns: new Set(["0,0"]),
            fluidLevels: new Map([["1,2,3", 2]]),
            inventory: [{itemId: "stone", count: 4}, ...emptyInventory().slice(1)],
            survivalInventory: emptyInventory(),
            selectedHotbar: 0,
            gameMode: "survival",
            renderDistance: 4,
            drops: [{id: "one", itemId: "dirt", count: 1, position: [2, 3, 4], createdAt: 100}],
            playerCrafting: [{itemId: "wood", count: 1}, null, null, null],
            tableCrafting: Array(9).fill(null),
            blockEntities: new Map([["2,3,4", {...createFurnace(50), input: {itemId: "sand", count: 1}}]]),
            blockStates: new Map([["4,5,6", {facing: "west", half: "upper", open: false, powered: true}]]),
            scheduledUpdates: [scheduleCrop([5, 6, 7], 1000)],
            worldTime: 180,
            entities: [{
                id: "saved-sheep", type: "sheep", position: [4, 8, 4], velocity: [0, 0, 0], health: 10,
                animationState: "idle", heading: 0, friendLevel: 2, followUntil: 0,
                lastInteraction: 0, lastGift: 0, persistent: true, chunk: [0, 0],
            }],
            spawnedCreatureGroups: new Set(["0,0:day"]),
            chunks: new Map([["0,0,0", new Map([[0, "stone"]])]]),
        };

        const parsed = parseWorldDocument(serializeWorld(state));
        expect(parsed.seed).toBe("storage seed");
        expect(parsed.generatedColumns.has("0,0")).toBe(true);
        expect(parsed.chunks.get("0,0,0").get(0)).toBe("stone");
        expect(parsed.fluidLevels.get("1,2,3")).toBe(2);
        expect(parsed.inventory[0]).toEqual({itemId: "stone", count: 4});
        expect(parsed.drops).toHaveLength(1);
        expect(parsed.playerCrafting[0].itemId).toBe("wood");
        expect(parsed.blockEntities.get("2,3,4").input.itemId).toBe("sand");
        expect(parsed.blockStates.get("4,5,6").facing).toBe("west");
        expect(parsed.blockStates.get("4,5,6").half).toBe("upper");
        expect(parsed.scheduledUpdates[0].position).toEqual([5, 6, 7]);
        expect(parsed.worldTime).toBe(180);
        expect(parsed.entities[0].friendLevel).toBe(2);
        expect(parsed.spawnedCreatureGroups.has("0,0:day")).toBe(true);
        expect(parsed.renderDistance).toBe(4);
    });

    test("compacts repeated chunk blocks with a palette and runs", () => {
        const chunk = new Map();
        for (let index = 0; index < 4096; index += 1) {
            chunk.set(index, index < 2048 ? "stone" : "dirt");
        }
        const state = {
            seed: "compact", texture: "dirt", playerPosition: [0, 2, 0], generatedColumns: new Set(),
            fluidLevels: new Map(), inventory: emptyInventory(), survivalInventory: emptyInventory(), selectedHotbar: 0,
            gameMode: "survival", drops: [], playerCrafting: Array(4).fill(null), tableCrafting: Array(9).fill(null),
            blockEntities: new Map(), blockStates: new Map(), scheduledUpdates: [], worldTime: 0,
            entities: [], spawnedCreatureGroups: new Set(), chunks: new Map([["0,0,0", chunk]]),
        };

        const serialized = serializeWorld(state);
        const document = JSON.parse(serialized);
        const legacySize = JSON.stringify([["0,0,0", Array.from(chunk)]]).length;
        expect(document.version).toBe(WORLD_VERSION);
        expect(document.chunks[0]).toEqual(["0,0,0", ["stone", "dirt"], [0, 2048, 0, 2048, 2048, 1]]);
        expect(serialized.length).toBeLessThan(legacySize / 20);
        expect(parseWorldDocument(serialized).chunks.get("0,0,0").size).toBe(4096);
    });

    test("still loads version 8 entry-based chunks", () => {
        const parsed = parseWorldDocument(JSON.stringify({
            version: 8,
            seed: "old chunks",
            texture: "dirt",
            chunks: [["0,0,0", [[0, "stone"], [15, "dirt"]]]],
        }));
        expect(parsed.chunks.get("0,0,0")).toEqual(new Map([[0, "stone"], [15, "dirt"]]));
    });

    test("round-trips chest contents and revision", () => {
        const chest = createChest();
        chest.slots[2] = {itemId: "wheat", count: 3};
        chest.revision = 4;
        const state = {
            seed: "chest", texture: "dirt", playerPosition: [0, 2, 0], generatedColumns: new Set(),
            fluidLevels: new Map(), inventory: emptyInventory(), survivalInventory: emptyInventory(), selectedHotbar: 0,
            gameMode: "survival", drops: [], playerCrafting: Array(4).fill(null), tableCrafting: Array(9).fill(null),
            blockEntities: new Map([["1,2,3", chest]]), blockStates: new Map(), scheduledUpdates: [], worldTime: 0,
            entities: [], spawnedCreatureGroups: new Set(), chunks: new Map(),
        };
        const parsed = parseWorldDocument(serializeWorld(state));
        expect(parsed.blockEntities.get("1,2,3").slots[2]).toEqual({itemId: "wheat", count: 3});
        expect(parsed.blockEntities.get("1,2,3").revision).toBe(4);
    });

    test("migrates valid cubes from the legacy save", () => {
        const parsed = parseWorldDocument(null, JSON.stringify([
            {pos: [-1, 2, 3], texture: "wood"},
            {pos: [0, 0, 0], texture: "unknown"},
        ]));

        expect(getBlock(parsed.chunks, [-1, 2, 3])).toBe("wood");
        expect(getBlock(parsed.chunks, [0, 0, 0])).toBeNull();
    });

    test("rejects malformed documents", () => {
        expect(parseWorldDocument("not json")).toBeNull();
        expect(parseWorldDocument(JSON.stringify({version: 1, chunks: []}))).toBeNull();
    });

    test("migrates version 2 saves into creative mode", () => {
        const parsed = parseWorldDocument(JSON.stringify({
            version: 2,
            seed: "old",
            texture: "dirt",
            chunks: [],
        }));
        expect(parsed.gameMode).toBe("creative");
        expect(parsed.inventory[0]).toEqual({itemId: "dirt", count: 64});
    });

    test("migrates the previous saved view distance to the new Ultra default", () => {
        const migrated = parseWorldDocument(JSON.stringify({
            version: 7,
            seed: "previous-default",
            texture: "dirt",
            renderDistance: 2,
            chunks: [],
        }));
        const current = parseWorldDocument(JSON.stringify({
            version: WORLD_VERSION,
            seed: "current-choice",
            texture: "dirt",
            renderDistance: 2,
            chunks: [],
        }));

        expect(migrated.renderDistance).toBe(4);
        expect(current.renderDistance).toBe(2);
    });

    test("persists the optional Extra view distance", () => {
        const parsed = parseWorldDocument(JSON.stringify({
            version: WORLD_VERSION,
            seed: "extra-view",
            texture: "dirt",
            renderDistance: 6,
            chunks: [],
        }));
        expect(parsed.renderDistance).toBe(6);
    });

    test("persists the Extra 2x view distance", () => {
        const parsed = parseWorldDocument(JSON.stringify({
            version: 8,
            seed: "extra-2x-view",
            texture: "dirt",
            renderDistance: 9,
            chunks: [],
        }));
        expect(parsed.renderDistance).toBe(9);
    });
});
