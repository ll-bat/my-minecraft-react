jest.mock("nanoid", () => ({nanoid: () => "test-id"}));

import {RENDER_DISTANCE, renderColumnOffsets, useStore, WORLD_STORAGE_KEY} from "./useStore";
import {getBlock, setBlock} from "../world/chunks";
import {emptyInventory} from "../world/inventory";

describe("world store", () => {
    beforeEach(() => {
        window.localStorage.clear();
        const inventory = emptyInventory();
        inventory[0] = {itemId: "dirt", count: 64};
        useStore.setState({
            texture: "dirt",
            inventory,
            survivalInventory: inventory,
            selectedHotbar: 0,
            gameMode: "survival",
            renderDistance: RENDER_DISTANCE,
            drops: [],
            fluidLevels: new Map(),
            fluidQueue: [],
            chunks: new Map(),
            generatedColumns: new Set(),
            chunkRevisions: new Map(),
            blockStates: new Map(),
            blockEntities: new Map(),
            scheduledUpdates: [],
            blockLight: new Map(),
            activeChunkKeys: [],
            entities: [],
            spawnedCreatureGroups: new Set(),
            creatureFeedback: "",
            dimension: "overworld",
            dimensionSnapshots: new Map(),
            exploredColumns: new Set(),
            discoveredBiomes: new Set(),
            discoveredStructures: [],
            markers: [],
            goals: {},
            gameRules: {dayCycle: true, weather: true, creatures: true, cropGrowth: true},
        });
    });

    test("adds a normalized cube and rejects an occupied position", () => {
        expect(useStore.getState().addCube(1.2, 2.8, -3.6)).toBe(true);
        expect(useStore.getState().addCube(1, 3, -4)).toBe(false);
        expect(getBlock(useStore.getState().chunks, [1, 3, -4])).toBe("dirt");
    });

    test("removes only the cube at the requested position", () => {
        useStore.getState().addCube(1, 2, 3);
        useStore.getState().addCube(4, 5, 6);

        expect(useStore.getState().removeCube(1, 2, 3)).toBe(true);
        expect(useStore.getState().removeCube(1, 2, 3)).toBe(false);
        expect(getBlock(useStore.getState().chunks, [4, 5, 6])).toBe("dirt");
        expect(useStore.getState().drops).toHaveLength(1);
    });

    test("saves a versioned world document", () => {
        useStore.getState().addCube(1, 2, 3);
        useStore.getState().saveWorld();

        const saved = JSON.parse(window.localStorage.getItem(WORLD_STORAGE_KEY));
        expect(saved.version).toBe(7);
        expect(saved.chunks).toHaveLength(1);
    });

    test("generates and activates the requested chunk columns", async () => {
        await useStore.getState().ensureColumns(0, 0, 0);

        expect(useStore.getState().generatedColumns.has("0,0")).toBe(true);
        expect(useStore.getState().activeChunkKeys.length).toBeGreaterThan(0);
    });

    test("keeps the previous view active while the next chunk column streams", async () => {
        await useStore.getState().ensureColumns(0, 0, 0);
        const loading = useStore.getState().ensureColumns(1, 0, 0);

        expect(useStore.getState().activeChunkKeys.some((key) => key.startsWith("0,"))).toBe(true);
        await loading;
        expect(useStore.getState().activeChunkKeys.every((key) => key.startsWith("1,"))).toBe(true);
    });

    test("uses a two-chunk render distance", () => {
        expect(RENDER_DISTANCE).toBe(2);
        expect(renderColumnOffsets(RENDER_DISTANCE)).toHaveLength(25);
        expect(renderColumnOffsets(RENDER_DISTANCE)).toContainEqual([2, 2]);
        expect(renderColumnOffsets(RENDER_DISTANCE)).not.toContainEqual([3, 0]);
    });

    test("accepts render distances one through four", () => {
        expect(useStore.getState().setRenderDistance(4)).toBe(true);
        expect(useStore.getState().renderDistance).toBe(4);
        expect(useStore.getState().setRenderDistance(5)).toBe(false);
        expect(useStore.getState().renderDistance).toBe(4);
    });

    test("keeps a placed water cube static", () => {
        useStore.getState().addCube(0, 1, 0);
        const inventory = useStore.getState().inventory.slice();
        inventory[1] = {itemId: "water", count: 1};
        useStore.getState().setInventory(inventory);
        useStore.getState().selectHotbar(1);
        useStore.getState().addCube(0, 2, 0);

        expect(useStore.getState().fluidQueue).toHaveLength(0);
        useStore.getState().processFluidStep();
        expect(getBlock(useStore.getState().chunks, [0, 2, 0])).toBe("water");
        expect(getBlock(useStore.getState().chunks, [1, 2, 0])).toBeNull();
        expect(getBlock(useStore.getState().chunks, [0, 3, 0])).toBeNull();
    });

    test("keeps placed blocks unlimited in survival and creative", () => {
        expect(useStore.getState().addCube(0, 1, 0)).toBe(true);
        expect(useStore.getState().inventory[0].count).toBe(64);
        useStore.getState().setGameMode("creative");
        const count = useStore.getState().inventory[0].count;
        expect(useStore.getState().addCube(1, 1, 0)).toBe(true);
        expect(useStore.getState().inventory[0].count).toBe(count);
        expect(useStore.getState().removeCube(0, 1, 0)).toBe(true);
        expect(useStore.getState().drops).toHaveLength(0);
    });

    test("removes an inventory stack and restores it from the catalog", () => {
        useStore.getState().removeInventorySlot(0);
        expect(useStore.getState().inventory[0]).toBeNull();
        expect(useStore.getState().addCatalogItem("door")).toBe(true);
        expect(useStore.getState().inventory[0]).toEqual({itemId: "door", count: 64});
    });

    test("places a friendly creature from the creature catalog", () => {
        const inventory = emptyInventory();
        inventory[0] = {itemId: "spawn_rabbit", count: 64};
        useStore.setState({inventory, survivalInventory: inventory, selectedHotbar: 0, chunks: setBlock(new Map(), [0, 1, 0], "grass"), entities: []});
        expect(useStore.getState().applySelectedItemToBlock([0, 1, 0], [0, 2, 0])).toBe(true);
        expect(useStore.getState().entities[0].type).toBe("rabbit");
        expect(useStore.getState().entities[0].persistent).toBe(true);
    });

    test("collects a nearby drop into inventory", () => {
        useStore.setState({
            inventory: emptyInventory(),
            survivalInventory: emptyInventory(),
            playerPosition: [0, 1, 0],
            drops: [{id: "drop", itemId: "stone", count: 2, position: [0, 1, 0], createdAt: 10}],
        });
        useStore.getState().updateDrops(20);
        expect(useStore.getState().drops).toHaveLength(0);
        expect(useStore.getState().inventory[0]).toEqual({itemId: "stone", count: 2});
    });

    test("finishes collecting a drop when the inventory is full", () => {
        const inventory = Array(36).fill(null).map(() => ({itemId: "dirt", count: 64}));
        useStore.setState({
            inventory,
            survivalInventory: inventory,
            playerPosition: [0, 1, 0],
            drops: [{id: "full-drop", itemId: "stone", count: 1, position: [0, 1, 0], createdAt: 10}],
        });
        useStore.getState().updateDrops(20);
        expect(useStore.getState().drops).toHaveLength(0);
        expect(useStore.getState().soundEvent.type).toBe("pickup");
    });

    test("despawns drops after five minutes", () => {
        useStore.setState({
            playerPosition: [20, 1, 20],
            drops: [{id: "old", itemId: "dirt", count: 1, position: [0, 1, 0], createdAt: 10}],
        });
        useStore.getState().updateDrops(300010);
        expect(useStore.getState().drops).toHaveLength(0);
    });

    test("crafts a recipe atomically into inventory", () => {
        useStore.setState({playerCrafting: [{itemId: "log", count: 1}, null, null, null]});
        expect(useStore.getState().craftItem("player")).toBe(true);
        expect(useStore.getState().playerCrafting.every((stack) => stack === null)).toBe(true);
        expect(useStore.getState().inventory.some((stack) => stack?.itemId === "wood")).toBe(true);
    });

    test("wears the selected tool and blocks under-tier ore drops", () => {
        const inventory = emptyInventory();
        inventory[0] = {itemId: "wooden_pickaxe", count: 1, durability: 30};
        useStore.setState({
            inventory,
            survivalInventory: inventory,
            selectedHotbar: 0,
            chunks: setBlock(new Map(), [0, 1, 0], "iron_ore"),
            drops: [],
        });
        expect(useStore.getState().removeCube(0, 1, 0)).toBe(true);
        expect(useStore.getState().inventory[0].durability).toBe(29);
        expect(useStore.getState().drops).toHaveLength(0);
    });

    test("processes a placed furnace entity", () => {
        const inventory = useStore.getState().inventory.slice();
        inventory[0] = {itemId: "furnace", count: 64};
        useStore.getState().setInventory(inventory);
        expect(useStore.getState().addCube(0, 1, 0)).toBe(true);
        useStore.getState().setFurnaceSlots([0, 1, 0], [
            {itemId: "sand", count: 1},
            {itemId: "coal", count: 1},
            null,
        ]);
        const entity = useStore.getState().blockEntities.get("0,1,0");
        useStore.getState().processFurnaces(entity.lastUpdated + 5000);
        expect(useStore.getState().blockEntities.get("0,1,0").output).toEqual({itemId: "glass", count: 1});
    });

    test("keeps chest contents and rejects a stale edit", () => {
        const inventory = useStore.getState().inventory.slice();
        inventory[0] = {itemId: "chest", count: 64};
        useStore.getState().setInventory(inventory);
        expect(useStore.getState().addCube(0, 1, 0, "east")).toBe(true);
        const slots = Array(27).fill(null);
        slots[0] = {itemId: "dirt", count: 5};
        expect(useStore.getState().setChestSlots([0, 1, 0], slots, 0)).toBe(true);
        expect(useStore.getState().setChestSlots([0, 1, 0], Array(27).fill(null), 0)).toBe(false);
        expect(useStore.getState().blockEntities.get("0,1,0").slots[0].count).toBe(5);
        expect(useStore.getState().blockStates.get("0,1,0").facing).toBe("east");
    });

    test("toggles a door into its open state", () => {
        useStore.setState({chunks: setBlock(new Map(), [0, 1, 0], "door")});
        expect(useStore.getState().interactBlock([0, 1, 0])).toBe(true);
        expect(getBlock(useStore.getState().chunks, [0, 1, 0])).toBe("door_open");
    });

    test("places, opens, and removes a two-block-tall door as one structure", () => {
        const inventory = emptyInventory();
        inventory[0] = {itemId: "door", count: 64};
        useStore.setState({inventory, survivalInventory: inventory, selectedHotbar: 0, chunks: new Map(), blockStates: new Map(), drops: []});
        expect(useStore.getState().addCube(2, 3, 4, "east")).toBe(true);
        expect(getBlock(useStore.getState().chunks, [2, 3, 4])).toBe("door");
        expect(getBlock(useStore.getState().chunks, [2, 4, 4])).toBe("door_top");
        useStore.getState().interactBlock([2, 4, 4]);
        expect(getBlock(useStore.getState().chunks, [2, 3, 4])).toBe("door_open");
        expect(getBlock(useStore.getState().chunks, [2, 4, 4])).toBe("door_open_top");
        useStore.getState().removeCube(2, 4, 4);
        expect(getBlock(useStore.getState().chunks, [2, 3, 4])).toBeNull();
        expect(getBlock(useStore.getState().chunks, [2, 4, 4])).toBeNull();
        expect(useStore.getState().drops.filter((drop) => drop.itemId === "door")).toHaveLength(1);
    });

    test("rejects a door when its upper block is occupied", () => {
        const inventory = emptyInventory();
        inventory[0] = {itemId: "door", count: 64};
        useStore.setState({inventory, survivalInventory: inventory, selectedHotbar: 0, chunks: setBlock(new Map(), [0, 4, 0], "stone")});
        expect(useStore.getState().addCube(0, 3, 0)).toBe(false);
    });

    test("keeps dimension terrain isolated and creates a return portal", () => {
        useStore.setState({chunks: setBlock(new Map(), [0, 1, 0], "stone"), playerPosition: [0, 3, 0]});
        useStore.getState().travelDimension();
        expect(useStore.getState().dimension).toBe("dream_grove");
        expect(Array.from(useStore.getState().chunks.values()).some((chunk) => Array.from(chunk.values()).includes("portal"))).toBe(true);
        useStore.getState().travelDimension();
        expect(useStore.getState().dimension).toBe("overworld");
        expect(getBlock(useStore.getState().chunks, [0, 1, 0])).toBe("stone");
    });

    test("enchants the selected tool without adding combat behavior", () => {
        const inventory = emptyInventory();
        inventory[0] = {itemId: "wooden_pickaxe", count: 1, durability: 30};
        inventory[1] = {itemId: "crystal", count: 1};
        useStore.setState({inventory, survivalInventory: inventory, selectedHotbar: 0, gameMode: "survival"});
        expect(useStore.getState().enchantSelectedTool()).toBe(true);
        expect(useStore.getState().inventory[0].enchantments).toEqual({efficiency: 1, unbreaking: 1});
        expect(useStore.getState().inventory[1]).toBeNull();
    });

    test("pets nearby creatures without changing health", () => {
        useStore.setState({
            playerPosition: [0, 8, 0],
            entities: [{
                id: "friend", type: "sheep", position: [1, 8, 0], velocity: [0, 0, 0], health: 10,
                animationState: "idle", heading: 0, friendLevel: 0, followUntil: 0,
                lastInteraction: 0, lastGift: 0, persistent: false, chunk: [0, 0],
            }],
        });
        expect(useStore.getState().interactCreature("friend", 1000)).toBe(true);
        expect(useStore.getState().entities[0].health).toBe(10);
        expect(useStore.getState().entities[0].friendLevel).toBe(1);
        expect(useStore.getState().creatureFeedback).toContain("became your friend");
    });
});
