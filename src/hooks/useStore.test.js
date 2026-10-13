jest.mock("nanoid", () => ({nanoid: () => "test-id"}));

import {MAX_RENDER_DISTANCE, RENDER_DISTANCE, renderColumnOffsets, useStore, WORLD_STORAGE_KEY} from "./useStore";
import {getBlock, setBlock} from "../world/chunks";
import {emptyInventory} from "../world/inventory";
import {cityForColumn, stadiumCenter, stadiumCenters, structureForColumn} from "../world/structures";
import {generateChunkColumn} from "../world/terrain";
import {worldDocumentKey} from "../world/worldCatalog";

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
            lightSourceRevision: 0,
            modelRevision: 0,
            activeChunkKeys: [],
            entities: [],
            spawnedCreatureGroups: new Set(),
            creatureFeedback: "",
            villagerPanelId: null,
            mountedEntityId: null,
            teleportRequest: null,
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

    test("keeps global render indexes stable for an ordinary local block edit", () => {
        const chunks = setBlock(new Map(), [0, 0, 0], "stone");
        const activeChunkKeys = ["0,0,0"];
        const blockLight = new Map([["100,4,100", 8]]);
        const fluidLevels = new Map([["20,1,20", 0]]);
        const blockStates = new Map([["20,1,20", {facing: "north"}]]);
        const blockEntities = new Map([["20,1,20", {type: "chest", slots: []}]]);
        useStore.setState({chunks, activeChunkKeys, blockLight, fluidLevels, blockStates, blockEntities, playerChunk: [0, 0]});

        expect(useStore.getState().addCube(1, 1, 1)).toBe(true);
        expect(useStore.getState().activeChunkKeys).toBe(activeChunkKeys);
        expect(useStore.getState().blockLight).toBe(blockLight);
        expect(useStore.getState().fluidLevels).toBe(fluidLevels);
        expect(useStore.getState().blockStates).toBe(blockStates);
        expect(useStore.getState().blockEntities).toBe(blockEntities);
        expect(useStore.getState().modelRevision).toBe(0);
        expect(useStore.getState().lightSourceRevision).toBe(0);
    });

    test("rebuilds model and light-source batches only for an emitting model", () => {
        const inventory = emptyInventory();
        inventory[0] = {itemId: "floor_lamp", count: 1};
        useStore.setState({inventory, survivalInventory: inventory, selectedHotbar: 0});
        expect(useStore.getState().addCube(1, 1, 1)).toBe(true);
        expect(useStore.getState().modelRevision).toBe(1);
        expect(useStore.getState().lightSourceRevision).toBe(1);
    });

    test("stores slab half and stair facing during placement", () => {
        const inventory = emptyInventory();
        inventory[0] = {itemId: "wood_slab", count: 64};
        inventory[1] = {itemId: "stone_stairs", count: 64};
        useStore.setState({inventory, survivalInventory: inventory, selectedHotbar: 0});
        expect(useStore.getState().addCube(0, 1, 0, "north", {half: "upper"})).toBe(true);
        useStore.getState().selectHotbar(1);
        expect(useStore.getState().addCube(1, 1, 0, "east", {half: "lower"})).toBe(true);
        expect(useStore.getState().blockStates.get("0,1,0").half).toBe("upper");
        expect(useStore.getState().blockStates.get("1,1,0")).toMatchObject({facing: "east", half: "lower"});
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

        const saved = JSON.parse(window.localStorage.getItem(worldDocumentKey(useStore.getState().worldUid)));
        expect(saved.version).toBe(9);
        expect(saved.chunks).toHaveLength(1);
        expect(window.localStorage.getItem(WORLD_STORAGE_KEY)).toBeNull();
    });

    test("new world removes old saved progress and immediately stores a fresh baseline", () => {
        useStore.setState({
            worldUid: "replace-current",
            worldName: "Replace Current",
            seed: "old-seed",
            chunks: setBlock(new Map(), [1, 2, 3], "stone"),
        });
        useStore.getState().saveWorld();

        useStore.getState().createWorld("new-seed");

        const saved = JSON.parse(window.localStorage.getItem(worldDocumentKey("replace-current")));
        expect(saved.seed).toBe("new-seed");
        expect(saved.chunks).toEqual([]);
        expect(useStore.getState().worldUid).toBe("replace-current");
        expect(useStore.getState().saveStatus).toBe("Fresh world saved");
    });

    test("regenerate removes saved edits and recreates the same seed", () => {
        useStore.setState({
            worldUid: "regenerate-current",
            worldName: "Regenerate Current",
            seed: "same-seed",
            chunks: setBlock(new Map(), [4, 5, 6], "wood"),
        });
        useStore.getState().saveWorld();

        useStore.getState().resetWorld();

        const saved = JSON.parse(window.localStorage.getItem(worldDocumentKey("regenerate-current")));
        expect(saved.seed).toBe("same-seed");
        expect(saved.chunks).toEqual([]);
        expect(useStore.getState().playerPosition).toEqual(useStore.getState().spawn);
    });

    test("generates and activates the requested chunk columns", async () => {
        await useStore.getState().ensureColumns(0, 0, 0);

        expect(useStore.getState().generatedColumns.has("0,0")).toBe(true);
        expect(useStore.getState().activeChunkKeys.length).toBeGreaterThan(0);
    });

    test("upgrades an already generated column when it belongs to the unique city", async () => {
        const seed = "existing-city-upgrade";
        let city = null;
        for (let x = -8; x <= 8 && !city; x += 1) for (let z = -8; z <= 8; z += 1) {
            const candidate = cityForColumn(seed, x, z);
            if (candidate?.districtX === 0 && candidate?.districtZ === 0) { city = candidate; break; }
        }
        const key = `${city.chunkX},${city.chunkZ}`;
        useStore.setState({
            seed,
            chunks: generateChunkColumn(seed, city.chunkX, city.chunkZ),
            generatedColumns: new Set([key]),
            spawnedCreatureGroups: new Set(),
            discoveredStructures: [],
            entities: [],
        });
        await useStore.getState().ensureColumns(city.chunkX, city.chunkZ, 0);
        const ids = Array.from(useStore.getState().chunks.values()).flatMap((chunk) => Array.from(chunk.values()));
        expect(ids).not.toContain("water");
        expect(ids).toContain("sign");
        expect(useStore.getState().spawnedCreatureGroups.has(`${city.id}:0,0:built:river-only-v4`)).toBe(true);
        expect(useStore.getState().discoveredStructures.filter((structure) => structure.id === city.id)).toHaveLength(1);
    });

    test("upgrades an already generated stadium column and adds stadium navigation", async () => {
        const seed = "existing-stadium-upgrade";
        const position = stadiumCenter(seed);
        const chunkX = Math.floor(position[0] / 16);
        const chunkZ = Math.floor(position[2] / 16);
        const stadium = structureForColumn(seed, chunkX, chunkZ);
        const key = `${chunkX},${chunkZ}`;
        useStore.setState({
            seed,
            chunks: generateChunkColumn(seed, chunkX, chunkZ),
            generatedColumns: new Set([key]),
            spawnedCreatureGroups: new Set(),
            discoveredStructures: [],
            entities: [],
        });
        await useStore.getState().ensureColumns(chunkX, chunkZ, 0);
        const ids = Array.from(useStore.getState().chunks.values()).flatMap((chunk) => Array.from(chunk.values()));
        expect(ids).toContain("metal_fence");
        expect(useStore.getState().spawnedCreatureGroups.has(`${stadium.id}:built:large-v2`)).toBe(true);

        useStore.getState().createWorld(seed, "Stadium navigation", "stadium-navigation");
        const stadiumMarkers = useStore.getState().markers.filter((marker) => marker.id.startsWith("generated-nearby-stadium-"));
        expect(stadiumMarkers).toHaveLength(6);
        expect(stadiumMarkers.map((marker) => marker.position)).toEqual(stadiumCenters(seed));
        expect(stadiumMarkers.slice(3).map((marker) => marker.name)).toEqual([
            "Grand Stadium 1",
            "Grand Stadium 2",
            "Grand Stadium 3",
        ]);
    });

    test("keeps the previous view active while the next chunk column streams", async () => {
        await useStore.getState().ensureColumns(0, 0, 0);
        const loading = useStore.getState().ensureColumns(1, 0, 0);

        expect(useStore.getState().activeChunkKeys.some((key) => key.startsWith("0,"))).toBe(true);
        await loading;
        expect(useStore.getState().activeChunkKeys.every((key) => key.startsWith("1,"))).toBe(true);
    });

    test("uses a two-chunk render distance", () => {
        expect(RENDER_DISTANCE).toBe(4);
        expect(renderColumnOffsets(RENDER_DISTANCE)).toHaveLength(81);
        expect(renderColumnOffsets(RENDER_DISTANCE)).toContainEqual([4, 4]);
        expect(renderColumnOffsets(RENDER_DISTANCE)).not.toContainEqual([5, 0]);
    });

    test("keeps Ultra as default and accepts both Extra render distances", () => {
        expect(RENDER_DISTANCE).toBe(4);
        expect(MAX_RENDER_DISTANCE).toBe(9);
        expect(useStore.getState().setRenderDistance(6)).toBe(true);
        expect(useStore.getState().renderDistance).toBe(6);
        expect(renderColumnOffsets(6)).toHaveLength(137);
        expect(renderColumnOffsets(6)).toContainEqual([6, 0]);
        expect(renderColumnOffsets(6)).not.toContainEqual([6, 6]);
        expect(useStore.getState().setRenderDistance(9)).toBe(true);
        expect(useStore.getState().renderDistance).toBe(9);
        expect(renderColumnOffsets(9)).toHaveLength(277);
        expect(renderColumnOffsets(9)).toContainEqual([9, 0]);
        expect(renderColumnOffsets(9)).not.toContainEqual([9, 9]);
        expect(useStore.getState().setRenderDistance(10)).toBe(false);
        expect(useStore.getState().renderDistance).toBe(9);
    });

    test("keeps a placed water cube static", () => {
        useStore.getState().addCube(0, 1, 0);
        const inventory = useStore.getState().inventory.slice();
        inventory[1] = {itemId: "water", count: 1};
        useStore.getState().setInventory(inventory);
        useStore.getState().selectHotbar(1);
        useStore.getState().addCube(0, 2, 0);

        expect(useStore.getState().fluidQueue).toHaveLength(0);
        expect(useStore.getState().fluidLevels.get("0,2,0")).toBe(0);
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

    test("uses a selected destructive tool to remove water and entities with left-click actions", () => {
        const inventory = emptyInventory();
        inventory[0] = {itemId: "wooden_axe", count: 1, durability: 30};
        const ship = {
            id: "ship:remove", type: "ship", position: [1, 2, 0], velocity: [0, 0, 0], health: 32,
            animationState: "idle", heading: 0, friendLevel: 1, followUntil: 0,
            lastInteraction: 0, lastGift: 0, persistent: true, chunk: [0, 0],
        };
        useStore.setState({
            inventory, survivalInventory: inventory, selectedHotbar: 0,
            chunks: setBlock(new Map(), [0, 1, 0], "water"), entities: [ship],
            playerPosition: [0, 2, 0], mountedEntityId: ship.id,
        });

        expect(useStore.getState().destroyBlockWithSelectedTool(0, 1, 0)).toBe(true);
        expect(getBlock(useStore.getState().chunks, [0, 1, 0])).toBeNull();
        expect(useStore.getState().inventory[0].durability).toBe(29);
        expect(useStore.getState().destroyEntityWithSelectedTool(ship.id)).toBe(true);
        expect(useStore.getState().entities).toHaveLength(0);
        expect(useStore.getState().mountedEntityId).toBeNull();
        expect(useStore.getState().inventory[0].durability).toBe(28);
    });

    test("prevents player mining from opening an unsupported void", () => {
        const inventory = emptyInventory();
        inventory[0] = {itemId: "wooden_pickaxe", count: 1, durability: 30};
        useStore.setState({
            inventory, survivalInventory: inventory, selectedHotbar: 0,
            chunks: setBlock(new Map(), [0, 2, 0], "stone"),
            interactionFeedback: "",
        });

        expect(useStore.getState().removeCubeSafely(0, 2, 0)).toBe(false);
        expect(getBlock(useStore.getState().chunks, [0, 2, 0])).toBe("stone");
        expect(useStore.getState().interactionFeedback).toContain("empty space below");

        useStore.setState({chunks: setBlock(useStore.getState().chunks, [0, 1, 0], "stone")});
        expect(useStore.getState().removeCubeSafely(0, 2, 0)).toBe(true);
        expect(getBlock(useStore.getState().chunks, [0, 2, 0])).toBeNull();
    });

    test("builds a selected two-point bridge atomically", () => {
        let chunks = setBlock(new Map(), [0, 5, 0], "stone");
        chunks = setBlock(chunks, [8, 5, 0], "stone");
        useStore.setState({
            chunks,
            playerPosition: [0, 20, 10],
            bridgeAnchor: null,
            interactionFeedback: "",
        });

        expect(useStore.getState().selectBridgeEndpoint([0, 5, 0], "wood")).toBe(true);
        expect(useStore.getState().bridgeAnchor).toEqual({position: [0, 5, 0], style: "wood"});
        expect(useStore.getState().selectBridgeEndpoint([8, 5, 0], "wood")).toBe(true);
        expect(useStore.getState().bridgeAnchor).toBeNull();
        expect(getBlock(useStore.getState().chunks, [4, 5, 0])).toBe("red_wood");
        expect(getBlock(useStore.getState().chunks, [4, 6, 1])).toBe("wood_railing");
        expect(useStore.getState().interactionFeedback).toContain("bridge built");
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

    test("releases a selected fish into the exact water block", () => {
        const inventory = emptyInventory();
        inventory[0] = {itemId: "spawn_fish_orange", count: 64};
        useStore.setState({inventory, survivalInventory: inventory, selectedHotbar: 0, chunks: setBlock(new Map(), [3, 5, 4], "water"), entities: []});
        expect(useStore.getState().applySelectedItemToBlock([3, 5, 4], [3, 6, 4])).toBe(true);
        expect(useStore.getState().entities[0]).toMatchObject({type: "fish_orange", position: [3, 5, 4], persistent: true});
    });

    test("places and mounts transport from the catalog", () => {
        const inventory = emptyInventory();
        inventory[0] = {itemId: "spawn_horse", count: 64};
        useStore.setState({inventory, survivalInventory: inventory, selectedHotbar: 0, chunks: setBlock(new Map(), [0, 1, 0], "grass"), entities: [], playerPosition: [0, 2, 1]});
        expect(useStore.getState().applySelectedItemToBlock([0, 1, 0], [0, 2, 0])).toBe(true);
        const horse = useStore.getState().entities[0];
        expect(horse.type).toBe("horse");
        expect(useStore.getState().interactCreature(horse.id)).toBe(true);
        expect(useStore.getState().mountedEntityId).toBe(horse.id);
        useStore.getState().dismount();
        expect(useStore.getState().mountedEntityId).toBeNull();
    });

    test("places and mounts a sailing ship only on water", () => {
        const inventory = emptyInventory();
        inventory[0] = {itemId: "spawn_ship", count: 64};
        let chunks = setBlock(new Map(), [0, 1, 0], "grass");
        chunks = setBlock(chunks, [3, 5, 4], "water");
        useStore.setState({inventory, survivalInventory: inventory, selectedHotbar: 0, chunks, entities: [], playerPosition: [3, 6, 8]});

        expect(useStore.getState().applySelectedItemToBlock([0, 1, 0], [0, 2, 0])).toBe(false);
        expect(useStore.getState().applySelectedItemToBlock([3, 5, 4], [3, 6, 4])).toBe(true);
        const ship = useStore.getState().entities[0];
        expect(ship).toMatchObject({type: "ship", position: [3, 5.5, 4], persistent: true});
        expect(useStore.getState().interactCreature(ship.id)).toBe(true);
        expect(useStore.getState().mountedEntityId).toBe(ship.id);
        expect(useStore.getState().teleportRequest.position).toEqual([3, 7.05, 4]);
    });

    test("rejects watercraft placement close enough for its collider to push the player underwater", () => {
        const inventory = emptyInventory();
        inventory[0] = {itemId: "spawn_boat", count: 64};
        const chunks = setBlock(new Map(), [0, 5, 0], "water");
        useStore.setState({inventory, survivalInventory: inventory, selectedHotbar: 0, chunks, entities: [], playerPosition: [0, 6, 1]});

        expect(useStore.getState().applySelectedItemToBlock([0, 5, 0], [0, 6, 0])).toBe(false);
        expect(useStore.getState().entities).toHaveLength(0);
        expect(useStore.getState().creatureFeedback).toMatch(/farther away/);
    });

    test("opens villager dialogue and completes a friendly trade", () => {
        const inventory = emptyInventory();
        inventory[0] = {itemId: "wheat", count: 4};
        const villager = {
            id: "villager:test", type: "villager", name: "Mira", profession: "farmer", position: [0, 2, 1],
            velocity: [0, 0, 0], health: 20, animationState: "idle", heading: 0, friendLevel: 0,
            followUntil: 0, lastInteraction: 0, lastGift: 0, persistent: true, home: [0, 0], chunk: [0, 0],
            task: {itemId: "seeds", count: 4, rewardItem: "wheat", rewardCount: 6, complete: false},
            trade: {costItem: "wheat", costCount: 4, rewardItem: "flower", rewardCount: 2},
        };
        useStore.setState({inventory, survivalInventory: inventory, entities: [villager], playerPosition: [0, 2, 0]});
        expect(useStore.getState().interactCreature(villager.id)).toBe(true);
        expect(useStore.getState().villagerPanelId).toBe(villager.id);
        expect(useStore.getState().tradeWithVillager()).toBe(true);
        expect(useStore.getState().inventory.some((stack) => stack?.itemId === "flower" && stack.count === 2)).toBe(true);
        expect(useStore.getState().entities[0].friendLevel).toBe(1);
    });

    test("moves between vertically aligned elevator platforms", () => {
        let chunks = setBlock(new Map(), [2, 2, 3], "elevator");
        chunks = setBlock(chunks, [2, 8, 3], "elevator");
        useStore.setState({chunks});
        expect(useStore.getState().interactBlock([2, 2, 3])).toBe(true);
        expect(useStore.getState().teleportRequest.position).toEqual([2, 9.05, 3]);
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

    test("keeps an exhausted tool selected when the mined block is collected", () => {
        const inventory = emptyInventory();
        inventory[0] = {itemId: "wooden_axe", count: 1, durability: 1};
        let chunks = setBlock(new Map(), [0, 0, 0], "stone");
        chunks = setBlock(chunks, [0, 1, 0], "log");
        useStore.setState({
            inventory,
            survivalInventory: inventory,
            selectedHotbar: 0,
            chunks,
            drops: [],
            playerPosition: [0, 1, 0],
        });

        expect(useStore.getState().removeCube(0, 1, 0)).toBe(true);
        expect(useStore.getState().inventory[0]).toMatchObject({itemId: "wooden_axe", durability: 30});
        useStore.getState().updateDrops(Date.now());

        expect(useStore.getState().inventory[0]).toMatchObject({itemId: "wooden_axe", durability: 30});
        expect(useStore.getState().inventory[1]).toEqual({itemId: "log", count: 1});
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
