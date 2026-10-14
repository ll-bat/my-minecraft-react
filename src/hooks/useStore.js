import create from "zustand";
import {nanoid} from "nanoid";
import {BLOCK_BY_ID, DEFAULT_BLOCK_ID, isBlockId} from "../world/blocks";
import {
    affectedChunkKeys,
    chunkCoordinate,
    columnKey,
    getBlock,
    locateBlock,
    neighboringChunkKeys,
    parseChunkKey,
    setBlock,
    setBlocks
} from "../world/chunks";
import {
    biomeAt,
    NATURAL_WATER_VERSION,
    spawnPosition,
    upgradeNaturalWaterColumn,
    WORLD_MAX_Y,
    WORLD_MIN_Y
} from "../world/terrain";
import {blockIntersectsPlayer, positionKey} from "../world/coordinates";
import {processFluidUpdate} from "../world/fluids";
import {
    clearSavedWorld,
    DEFAULT_WORLD_SEED,
    readWorld,
    WORLD_STORAGE_KEY,
    writeWorld
} from "../world/worldStorage";
import {
    addItem,
    catalogInventory,
    creativeInventory,
    shiftMove,
    transferStack
} from "../world/inventory";
import {isDestructiveTool, ITEM_BY_ID, isItemId} from "../world/items";
import {consumeRecipe, findCraftingRecipe} from "../world/crafting";
import {damageTool, miningDrop} from "../world/mining";
import {advanceFurnace, createFurnace, FUEL_TIME, SMELTING_RECIPES} from "../world/furnaces";
import {
    CREATURE_TYPES,
    interactWithCreature,
    isNightTime,
    spawnCommunityForStructure,
    spawnCreaturesForColumn,
    spawnFishForColumn,
    updateCreature
} from "../world/entities";
import {emittedLight, rebuildBlockLight, updateBlockLightInPlace} from "../world/lighting";
import {
    createChest,
    growCrop,
    isCrop,
    propagateSwitch,
    scheduleCrop,
    toggleBlock
} from "../world/interactions";
import {consumeItem} from "../world/inventory";
import {worldCatalog} from "../world/worldStorage";
import {registerDataPack, registerSavedPacks, saveDataPack} from "../world/dataPacks";
import {generateTerrainColumnAsync} from "../world/terrainStreaming";
import {addStructure, cityCenter, stadiumLocations, structureForColumn} from "../world/structures";
import {bridgeEndpointError, planBridge} from "../world/bridges";
import {worldApi} from "../api/worldApi";
import {
    allPersistentChunkKeys,
    applyRemoteChunks,
    buildAutosavePayload,
    documentFromBootstrap,
    markDirtyPositions,
    persistenceChunkKey,
    remoteDocument
} from "../world/remoteWorld";
import {nextMorningWorldTime, normalizeWeather, worldTimeForDayPeriod} from "../world/sky";

export {WORLD_STORAGE_KEY};

export const RENDER_DISTANCE = 4;
export const MAX_RENDER_DISTANCE = 9;
const TERRAIN_LIGHT_DEFINITIONS = Object.fromEntries(Object.values(BLOCK_BY_ID).map((block) => [
    block.id,
    {
        light: block.light,
        solid: Boolean(block.solid),
        transparent: Boolean(block.transparent),
    },
]));
const installedPacks = registerSavedPacks();
let terrainGenerationRequest = 0;
let previousTerrainView = null;
let pendingRemoteSave = null;

function scheduleTerrainWork(callback) {
    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(callback, {timeout: 50});
        return;
    }
    setTimeout(callback, 0);
}

function scheduleMeshActivation(callback) {
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(callback);
        return;
    }
    setTimeout(callback, 0);
}

function bumpRevisions(revisions, keys) {
    const next = new Map(revisions);
    keys.forEach((key) => next.set(key, (next.get(key) ?? 0) + 1));
    return next;
}

function dirtyPositions(state, positions) {
    return markDirtyPositions(state.dirtyChunks, state.dimension, positions);
}

function uniqueEntities(entities) {
    const ids = new Set();
    return entities.filter((entity) => {
        if (!entity?.id || ids.has(entity.id)) return false;
        ids.add(entity.id);
        return true;
    });
}

function appendUniqueEntities(state, current, candidates) {
    const ids = new Set(current.map((entity) => entity.id));
    return [...current, ...candidates.filter((entity) => {
        if (state.deletedEntityIds?.has(entity.id) || ids.has(entity.id)) return false;
        ids.add(entity.id);
        return true;
    })];
}

function itemCount(inventory, itemId) {
    return inventory.reduce((total, stack) => total + (stack?.itemId === itemId ? stack.count : 0), 0);
}

function removeItems(inventory, itemId, requested) {
    let remaining = requested;
    const next = inventory.map((stack) => {
        if (!stack || stack.itemId !== itemId || remaining <= 0) return stack ? {...stack} : null;
        const removed = Math.min(stack.count, remaining);
        remaining -= removed;
        return stack.count === removed ? null : {...stack, count: stack.count - removed};
    });
    return remaining === 0 ? next : null;
}

function communityGroupForStructure(structure) {
    if (!structure) return null;
    return structure.type === "city"
        ? `${structure.id}:${structure.districtX},${structure.districtZ}:community`
        : `${structure.id}:community`;
}

function builtGroupForStructure(structure) {
    if (structure?.type === "city") return `${structure.id}:${structure.districtX},${structure.districtZ}:built:${NATURAL_WATER_VERSION}`;
    if (structure?.type === "stadium") return structure.size === "grand"
        ? `${structure.id}:built:grand-v1`
        : `${structure.id}:built:large-v2`;
    if (structure?.type === "hotel" || structure?.type === "well") return `${structure.id}:built:${NATURAL_WATER_VERSION}`;
    return null;
}

function generatedWorldMarkers(seed) {
    const markers = [{
        id: "generated-small-city",
        name: "Small City",
        position: cityCenter(seed),
        dimension: "overworld",
        color: "#e4b65d",
    }];
    stadiumLocations(seed).forEach(({position, size}, index) => markers.push({
        id: `generated-nearby-stadium-${index + 1}`,
        name: size === "grand" ? `Grand Stadium ${index - 2}` : `Stadium ${index + 1}`,
        position,
        dimension: "overworld",
        color: size === "grand" ? "#e4a84f" : "#68c77a",
    }));
    return markers;
}

function mergeGeneratedColumn(chunks, generated, dimension, authoritativeChunks) {
    const next = new Map(chunks);
    generated.forEach((generatedChunk, key) => {
        if (authoritativeChunks?.has(persistenceChunkKey(dimension, key))) {
            if (!next.has(key)) next.set(key, new Map());
            return;
        }
        const existing = next.get(key);
        next.set(key, existing
            ? new Map([...generatedChunk, ...existing])
            : generatedChunk
        );
    });
    return next;
}

export function renderColumnOffsets(distance) {
    const normalized = Math.max(0, Number(distance) || 0);
    const edge = Math.ceil(normalized);
    // Extra views keep their full reach on every axis while rounding the
    // distant corners. Extra 2x therefore uses about twice Extra's columns
    // instead of paying for a 19 by 19 square.
    const rounded = !Number.isInteger(normalized) || normalized >= 6;
    const offsets = [];
    for (let x = -edge; x <= edge; x += 1) {
        for (let z = -edge; z <= edge; z += 1) {
            const padding = normalized >= 9 ? 0.25 : normalized >= 6 ? 0.5 : 1;
            if (!rounded || Math.hypot(x, z) <= normalized + padding) offsets.push([x, z]);
        }
    }
    return offsets;
}

function activeKeys(chunks, centerX, centerZ, distance) {
    const visibleColumns = new Set(renderColumnOffsets(distance).map(([x, z]) => `${centerX + x},${centerZ + z}`));
    return Array.from(chunks.keys())
        .filter((key) => {
            const [chunkX, , chunkZ] = parseChunkKey(key);
            return visibleColumns.has(columnKey(chunkX, chunkZ));
        })
        .sort();
}

function activeKeysAfterEdits(currentKeys, chunks, centerX, centerZ, distance, positions) {
    const visibleColumns = new Set(renderColumnOffsets(distance).map(([x, z]) => `${centerX + x},${centerZ + z}`));
    const editedKeys = new Set(positions.map((position) => locateBlock(position).chunkKey));
    const next = new Set(currentKeys);
    let changed = false;
    editedKeys.forEach((key) => {
        const [chunkX, , chunkZ] = parseChunkKey(key);
        const shouldBeActive = visibleColumns.has(columnKey(chunkX, chunkZ)) && chunks.has(key);
        if (shouldBeActive && !next.has(key)) {
            next.add(key);
            changed = true;
        } else if (!shouldBeActive && next.delete(key)) {
            changed = true;
        }
    });
    return changed ? Array.from(next).sort() : currentKeys;
}

function initialState() {
    const saved = readWorld();
    const seed = saved?.seed ?? DEFAULT_WORLD_SEED;
    const playerPosition = saved?.playerPosition ?? spawnPosition(seed);
    const generatedMarkers = generatedWorldMarkers(seed);
    const markers = [...(saved?.markers ?? [])].filter((marker) => marker.id !== "generated-nearest-stadium");
    generatedMarkers.forEach((marker) => {
        if (!markers.some((existing) => existing.id === marker.id)) markers.push(marker);
    });
    const spawnedCreatureGroups = new Set(saved?.spawnedCreatureGroups ?? []);
    let entities = saved?.entities ?? [];
    if ((saved?.gameRules?.creatures ?? true) && saved?.chunks) {
        (saved.discoveredStructures ?? []).forEach((structure) => {
            const group = communityGroupForStructure(structure);
            if (spawnedCreatureGroups.has(group)) return;
            entities = [...entities, ...spawnCommunityForStructure(seed, structure, saved.chunks)];
            spawnedCreatureGroups.add(group);
        });
        const centerChunk = [chunkCoordinate(playerPosition[0]), chunkCoordinate(playerPosition[2])];
        (saved.generatedColumns ?? []).forEach((key) => {
            const [chunkX, chunkZ] = key.split(",").map(Number);
            const group = `${key}:fish`;
            if (spawnedCreatureGroups.has(group) || Math.hypot(chunkX - centerChunk[0], chunkZ - centerChunk[1]) > (saved.renderDistance ?? RENDER_DISTANCE) + 1) return;
            entities = [...entities, ...spawnFishForColumn(seed, chunkX, chunkZ, saved.chunks, playerPosition)];
            spawnedCreatureGroups.add(group);
        });
    }
    return {
        seed,
        worldUid: saved?.worldMeta?.id ?? "world-default",
        worldName: saved?.worldMeta?.name ?? "My World",
        worldCreatedAt: saved?.worldMeta?.createdAt ?? Date.now(),
        worlds: worldCatalog(),
        texture: saved?.texture ?? DEFAULT_BLOCK_ID,
        chunks: saved?.chunks ?? new Map(),
        generatedColumns: saved?.generatedColumns ?? new Set(),
        chunkRevisions: new Map(),
        fluidLevels: saved?.fluidLevels ?? new Map(),
        fluidQueue: [],
        inventory: catalogInventory(saved?.inventory),
        survivalInventory: catalogInventory(saved?.survivalInventory ?? saved?.inventory),
        selectedHotbar: saved?.selectedHotbar ?? 0,
        gameMode: saved?.gameMode ?? "survival",
        renderDistance: saved?.renderDistance ?? RENDER_DISTANCE,
        inventoryOpen: false,
        drops: saved?.drops ?? [],
        playerCrafting: saved?.playerCrafting ?? Array(4).fill(null),
        tableCrafting: saved?.tableCrafting ?? Array(9).fill(null),
        blockEntities: saved?.blockEntities ?? new Map(),
        blockStates: saved?.blockStates ?? new Map(),
        scheduledUpdates: saved?.scheduledUpdates ?? [],
        blockLight: rebuildBlockLight(saved?.chunks ?? new Map()),
        lightSourceRevision: 0,
        modelRevision: 0,
        station: null,
        stationPosition: null,
        entities,
        spawnedCreatureGroups,
        worldTime: saved?.worldTime ?? 0,
        skyWeather: normalizeWeather(saved?.skyWeather),
        dimension: saved?.dimension ?? "overworld",
        dimensionSnapshots: saved?.dimensionSnapshots ?? new Map(),
        exploredColumns: saved?.exploredColumns ?? new Set(),
        discoveredBiomes: saved?.discoveredBiomes ?? new Set(),
        markers,
        discoveredStructures: saved?.discoveredStructures ?? [],
        goals: saved?.goals ?? {},
        gameRules: saved?.gameRules ?? {dayCycle: true, weather: true, creatures: true, cropGrowth: true},
        enabledPacks: saved?.enabledPacks ?? installedPacks.map((pack) => pack.namespace),
        packsOpen: false,
        debugOpen: false,
        mapOpen: false,
        worldManagerOpen: false,
        creatureFeedback: "",
        villagerPanelId: null,
        mountedEntityId: null,
        teleportRequest: null,
        interactionFeedback: "",
        soundEvent: null,
        particleEvent: null,
        activeChunkKeys: [],
        collisionReadyChunkKeys: new Set(),
        bridgeAnchor: null,
        playerPosition,
        playerChunk: [chunkCoordinate(playerPosition[0]), chunkCoordinate(playerPosition[2])],
        spawn: spawnPosition(seed),
        worldId: 1,
        saveStatus: "",
        persistenceReady: false,
        persistenceRevision: 0,
        persistenceIncarnationId: null,
        persistencePositionVersion: 0,
        persistenceConflict: false,
        persistenceSuspended: false,
        dirtyChunks: new Map(),
        entityTombstones: new Map(),
        deletedEntityIds: new Set(),
        remoteAuthoritativeChunks: new Set(),
        remoteLoadedColumns: new Set(),
        renderMetrics: null,
    };
}

export const useStore = create((set, get) => ({
    ...initialState(),

    ensureColumns: (centerX, centerZ, requestedDistance = null, remoteChecked = false) => {
        if (get().persistenceReady && !remoteChecked) {
            return get().loadRemoteRegion(centerX, centerZ, requestedDistance ?? get().renderDistance)
                .then(() => get().ensureColumns(centerX, centerZ, requestedDistance, true));
        }
        const distance = requestedDistance ?? get().renderDistance;
        const requestId = ++terrainGenerationRequest;
        const initial = get();
        const generationIdentity = {
            worldId: initial.worldId,
            seed: initial.seed,
            dimension: initial.dimension,
        };
        const retainedKeys = previousTerrainView
            && previousTerrainView.worldId === generationIdentity.worldId
            && previousTerrainView.dimension === generationIdentity.dimension
            ? activeKeys(
                initial.chunks,
                previousTerrainView.centerX,
                previousTerrainView.centerZ,
                previousTerrainView.distance
            )
            : initial.activeChunkKeys;
        previousTerrainView = {...generationIdentity, centerX, centerZ, distance};
        const columns = renderColumnOffsets(distance)
            .map(([offsetX, offsetZ]) => [centerX + offsetX, centerZ + offsetZ])
            .sort((left, right) => (
                Math.hypot(left[0] - centerX, left[1] - centerZ)
                - Math.hypot(right[0] - centerX, right[1] - centerZ)
            ));
        const isCurrentRequest = () => {
            const state = get();
            return requestId === terrainGenerationRequest
                && state.worldId === generationIdentity.worldId
                && state.seed === generationIdentity.seed
                && state.dimension === generationIdentity.dimension;
        };

        set({activeChunkKeys: retainedKeys});

        return new Promise((resolve) => {
            let cursor = 0;
            const finish = () => {
                if (!isCurrentRequest()) {
                    resolve(false);
                    return;
                }
                set((state) => ({activeChunkKeys: activeKeys(state.chunks, centerX, centerZ, distance)}));
                resolve(true);
            };
            const activateChunkKeys = (keys, done) => {
                const playerChunkY = chunkCoordinate(get().playerPosition[1]);
                const pendingKeys = keys
                    .filter((key) => !get().activeChunkKeys.includes(key))
                    .sort((left, right) => (
                        Math.abs(parseChunkKey(left)[1] - playerChunkY)
                        - Math.abs(parseChunkKey(right)[1] - playerChunkY)
                    ));
                const activateNext = () => {
                    if (!isCurrentRequest()) {
                        resolve(false);
                        return;
                    }
                    const key = pendingKeys.shift();
                    if (!key) {
                        done();
                        return;
                    }
                    set((state) => ({
                        activeChunkKeys: state.activeChunkKeys.includes(key)
                            ? state.activeChunkKeys
                            : [...state.activeChunkKeys, key].sort(),
                    }));
                    scheduleMeshActivation(activateNext);
                };
                activateNext();
            };
            const generateNext = () => {
                if (!isCurrentRequest()) {
                    resolve(false);
                    return;
                }
                if (cursor >= columns.length) {
                    finish();
                    return;
                }

                const [chunkX, chunkZ] = columns[cursor];
                cursor += 1;
                const key = columnKey(chunkX, chunkZ);
                let beforeGeneration = get();
                if (beforeGeneration.generatedColumns.has(key)) {
                    const naturalWaterUpgradeGroup = `${key}:${NATURAL_WATER_VERSION}`;
                    if (generationIdentity.dimension === "overworld"
                        && !beforeGeneration.spawnedCreatureGroups.has(naturalWaterUpgradeGroup)) {
                        set((state) => ({
                            chunks: upgradeNaturalWaterColumn(
                                state.chunks,
                                generationIdentity.seed,
                                chunkX,
                                chunkZ,
                                state.fluidLevels
                            ),
                            spawnedCreatureGroups: new Set(state.spawnedCreatureGroups).add(naturalWaterUpgradeGroup),
                            chunkRevisions: bumpRevisions(
                                state.chunkRevisions,
                                Array.from(state.chunks.keys()).filter((chunkKeyValue) => {
                                    const [existingX, , existingZ] = parseChunkKey(chunkKeyValue);
                                    return existingX === chunkX && existingZ === chunkZ;
                                }).flatMap(neighboringChunkKeys)
                            ),
                        }));
                        beforeGeneration = get();
                    }
                    const existingStructure = generationIdentity.dimension === "overworld"
                        ? structureForColumn(generationIdentity.seed, chunkX, chunkZ, generationIdentity.dimension)
                        : null;
                    const structureBuiltGroup = builtGroupForStructure(existingStructure);
                    if (structureBuiltGroup && !beforeGeneration.spawnedCreatureGroups.has(structureBuiltGroup)) {
                        set((state) => {
                            const chunks = addStructure(state.chunks, generationIdentity.seed, {...existingStructure, dimensionSeed: generationIdentity.seed});
                            const spawnedCreatureGroups = new Set(state.spawnedCreatureGroups).add(structureBuiltGroup);
                            const communityGroup = communityGroupForStructure(existingStructure);
                            let entities = state.entities;
                            if (state.gameRules.creatures && !spawnedCreatureGroups.has(communityGroup)) {
                                entities = appendUniqueEntities(state, entities, spawnCommunityForStructure(generationIdentity.seed, existingStructure, chunks));
                                spawnedCreatureGroups.add(communityGroup);
                            }
                            const structureIsNew = !state.discoveredStructures.some((entry) => entry.id === existingStructure.id);
                            const structureRadius = existingStructure.type === "stadium" ? 1 : 0;
                            const revisedKeys = Array.from(chunks.keys()).filter((chunkKeyValue) => {
                                const [existingX, , existingZ] = parseChunkKey(chunkKeyValue);
                                return Math.abs(existingX - chunkX) <= structureRadius
                                    && Math.abs(existingZ - chunkZ) <= structureRadius;
                            }).flatMap(neighboringChunkKeys);
                            return {
                                chunks,
                                entities,
                                spawnedCreatureGroups,
                                chunkRevisions: bumpRevisions(state.chunkRevisions, revisedKeys),
                                ...(structureIsNew ? {
                                    discoveredStructures: [...state.discoveredStructures, existingStructure],
                                    goals: {...state.goals, structures: (state.goals.structures ?? 0) + 1},
                                } : {}),
                            };
                        });
                    }
                    const fishGroup = `${key}:fish`;
                    if (beforeGeneration.gameRules.creatures && generationIdentity.dimension === "overworld" && !beforeGeneration.spawnedCreatureGroups.has(fishGroup)) {
                        set((state) => ({
                            entities: appendUniqueEntities(state, state.entities, spawnFishForColumn(generationIdentity.seed, chunkX, chunkZ, state.chunks, state.playerPosition)),
                            spawnedCreatureGroups: new Set(state.spawnedCreatureGroups).add(fishGroup),
                        }));
                    }
                    const existingKeys = Array.from(beforeGeneration.chunks.keys()).filter((chunkKeyValue) => {
                        const [existingX, , existingZ] = parseChunkKey(chunkKeyValue);
                        return existingX === chunkX && existingZ === chunkZ;
                    });
                    if (existingKeys.every((chunkKeyValue) => beforeGeneration.activeChunkKeys.includes(chunkKeyValue))) {
                        generateNext();
                    } else {
                        activateChunkKeys(existingKeys, () => scheduleTerrainWork(generateNext));
                    }
                    return;
                }

                generateTerrainColumnAsync({
                    seed: generationIdentity.seed,
                    dimension: generationIdentity.dimension,
                    chunkX,
                    chunkZ,
                    lightDefinitions: TERRAIN_LIGHT_DEFINITIONS,
                }).then(({chunks: generated, structure, blockLight: generatedLight}) => {
                    if (!isCurrentRequest()) {
                        resolve(false);
                        return;
                    }
                    set((state) => {
                        const chunks = mergeGeneratedColumn(state.chunks, generated, generationIdentity.dimension, state.remoteAuthoritativeChunks);
                        const generatedColumns = new Set(state.generatedColumns).add(key);
                        const revisedKeys = Array.from(generated.keys()).flatMap(neighboringChunkKeys);
                        const chunkRevisions = bumpRevisions(state.chunkRevisions, revisedKeys);
                        const blockLight = new Map(state.blockLight);
                        generatedLight.forEach((level, position) => {
                            blockLight.set(position, Math.max(level, blockLight.get(position) ?? 0));
                        });
                        const creatureGroup = `${key}:day`;
                        const spawnedCreatureGroups = new Set(state.spawnedCreatureGroups);
                        if (generationIdentity.dimension === "overworld") {
                            spawnedCreatureGroups.add(`${key}:${NATURAL_WATER_VERSION}`);
                        }
                        let entities = state.entities;
                        if (state.gameRules.creatures && !spawnedCreatureGroups.has(creatureGroup)) {
                            entities = appendUniqueEntities(state, entities, spawnCreaturesForColumn(
                                generationIdentity.seed,
                                chunkX,
                                chunkZ,
                                state.playerPosition,
                                false
                            ));
                            spawnedCreatureGroups.add(creatureGroup);
                        }
                        const fishGroup = `${key}:fish`;
                        if (state.gameRules.creatures && generationIdentity.dimension === "overworld" && !spawnedCreatureGroups.has(fishGroup)) {
                            entities = appendUniqueEntities(state, entities, spawnFishForColumn(generationIdentity.seed, chunkX, chunkZ, chunks, state.playerPosition));
                            spawnedCreatureGroups.add(fishGroup);
                        }
                        const communityGroup = communityGroupForStructure(structure);
                        if (state.gameRules.creatures && communityGroup && !spawnedCreatureGroups.has(communityGroup)) {
                            entities = appendUniqueEntities(state, entities, spawnCommunityForStructure(generationIdentity.seed, structure, chunks));
                            spawnedCreatureGroups.add(communityGroup);
                        }
                        const structureBuiltGroup = builtGroupForStructure(structure);
                        if (structureBuiltGroup) spawnedCreatureGroups.add(structureBuiltGroup);
                        const structureIsNew = structure
                            && !state.discoveredStructures.some((entry) => entry.id === structure.id);
                        return {
                            chunks,
                            generatedColumns,
                            chunkRevisions,
                            blockLight,
                            lightSourceRevision: state.lightSourceRevision + 1,
                            entities,
                            spawnedCreatureGroups,
                            ...(structureIsNew ? {
                                discoveredStructures: [...state.discoveredStructures, structure],
                                goals: {...state.goals, structures: (state.goals.structures ?? 0) + 1},
                            } : {}),
                        };
                    });
                    activateChunkKeys(Array.from(generated.keys()), () => scheduleTerrainWork(generateNext));
                });
            };

            scheduleTerrainWork(generateNext);
        });
    },

    addCube: (x, y, z, facing = "north", placementState = {}) => {
        const position = [Math.round(x), Math.round(y), Math.round(z)];
        const state = get();
        const stack = state.inventory[state.selectedHotbar];
        const item = stack ? ITEM_BY_ID[stack.itemId] : null;
        const placingDoor = item?.blockId === "door";
        const upperPosition = [position[0], position[1] + 1, position[2]];
        if (
            position[1] <= WORLD_MIN_Y
            || position[1] > WORLD_MAX_Y
            || getBlock(state.chunks, position)
            || (placingDoor && (upperPosition[1] > WORLD_MAX_Y || getBlock(state.chunks, upperPosition)))
            || !item?.blockId
        ) {
            return false;
        }

        set((state) => {
            const changedPositions = placingDoor ? [position, upperPosition] : [position];
            const chunks = setBlocks(state.chunks, changedPositions.map((changedPosition, index) => ({
                position: changedPosition,
                blockId: index === 0 ? item.blockId : "door_top",
            })));
            const definition = BLOCK_BY_ID[item.blockId];
            let fluidLevels = state.fluidLevels;
            let blockEntities = state.blockEntities;
            let blockStates = state.blockStates;
            if (item.blockId === "furnace") {
                blockEntities = new Map(blockEntities);
                blockEntities.set(positionKey(position), createFurnace());
            }
            if (item.blockId === "chest") {
                blockEntities = new Map(blockEntities);
                blockEntities.set(positionKey(position), createChest());
            }
            if (definition?.fluid) {
                fluidLevels = new Map(fluidLevels);
                fluidLevels.set(positionKey(position), 0);
            }
            const usesHalf = definition?.shape === "slab" || definition?.shape === "stairs";
            if (definition?.oriented || usesHalf) {
                blockStates = new Map(blockStates);
                blockStates.set(positionKey(position), {
                    facing,
                    open: false,
                    powered: false,
                    ...(usesHalf ? {half: placementState.half === "upper" ? "upper" : "lower"} : {}),
                });
            }
            if (placingDoor) {
                if (blockStates === state.blockStates) blockStates = new Map(blockStates);
                blockStates.set(positionKey(upperPosition), {facing, open: false, powered: false});
            }
            return {
                chunks,
                blockEntities,
                blockStates,
                modelRevision: state.modelRevision + (definition?.modelId ? 1 : 0),
                lightSourceRevision: state.lightSourceRevision + (emittedLight(item.blockId) ? 1 : 0),
                blockLight: updateBlockLightInPlace(chunks, state.blockLight, changedPositions),
                soundEvent: {id: nanoid(), type: "place", blockId: item.blockId},
                particleEvent: {id: nanoid(), type: "place", position},
                goals: {...state.goals, blocksPlaced: (state.goals.blocksPlaced ?? 0) + 1},
                fluidLevels,
                fluidQueue: state.fluidQueue,
                chunkRevisions: bumpRevisions(state.chunkRevisions, changedPositions.flatMap(affectedChunkKeys)),
                dirtyChunks: dirtyPositions(state, changedPositions),
                activeChunkKeys: activeKeysAfterEdits(
                    state.activeChunkKeys,
                    chunks,
                    state.playerChunk[0],
                    state.playerChunk[1],
                    state.renderDistance,
                    changedPositions
                ),
            };
        });
        return true;
    },

    selectBridgeEndpoint: (position, style) => {
        const endpoint = position.map(Math.round);
        const state = get();
        const endpointError = bridgeEndpointError(state.chunks, endpoint);
        if (endpointError) {
            set({interactionFeedback: endpointError});
            return false;
        }
        if (!state.bridgeAnchor || state.bridgeAnchor.style !== style) {
            set({
                bridgeAnchor: {position: endpoint, style},
                interactionFeedback: "Bridge start selected · aim at a level endpoint and click again",
            });
            return true;
        }

        const plan = planBridge(state.chunks, state.bridgeAnchor.position, endpoint, style);
        if (!plan.ok) {
            set({interactionFeedback: plan.error});
            return false;
        }
        if (plan.placements.some(({position: planned}) => blockIntersectsPlayer(planned, state.playerPosition))) {
            set({interactionFeedback: "Move away from the bridge path before building"});
            return false;
        }

        const chunks = setBlocks(state.chunks, plan.placements);
        const revisedKeys = Array.from(new Set(plan.placements.flatMap(({position: planned}) => affectedChunkKeys(planned))));
        set({
            chunks,
            bridgeAnchor: null,
            blockLight: updateBlockLightInPlace(chunks, state.blockLight, plan.placements.map(({position: planned}) => planned)),
            lightSourceRevision: state.lightSourceRevision
                + (plan.placements.some(({blockId}) => emittedLight(blockId)) ? 1 : 0),
            chunkRevisions: bumpRevisions(state.chunkRevisions, revisedKeys),
            dirtyChunks: dirtyPositions(state, plan.placements.map(({position: planned}) => planned)),
            activeChunkKeys: activeKeysAfterEdits(
                state.activeChunkKeys,
                chunks,
                state.playerChunk[0],
                state.playerChunk[1],
                state.renderDistance,
                plan.placements.map(({position: planned}) => planned)
            ),
            goals: {...state.goals, blocksPlaced: (state.goals.blocksPlaced ?? 0) + plan.placements.length},
            soundEvent: {id: nanoid(), type: "place", blockId: plan.placements[0]?.blockId ?? "wood"},
            particleEvent: {id: nanoid(), type: "place", position: endpoint},
            interactionFeedback: `${plan.style === "stone" ? "Stone" : "Wooden"} bridge built · ${plan.length} blocks long`,
        });
        return true;
    },

    cancelBridge: () => {
        if (!get().bridgeAnchor) return false;
        set({bridgeAnchor: null, interactionFeedback: "Bridge placement cancelled"});
        return true;
    },

    removeCube: (x, y, z) => {
        const position = [Math.round(x), Math.round(y), Math.round(z)];
        const blockId = getBlock(get().chunks, position);
        if (!blockId || blockId === "bedrock") {
            return false;
        }

        const isDoor = ["door", "door_top", "door_open", "door_open_top"].includes(blockId);
        const basePosition = isDoor && blockId.endsWith("_top")
            ? [position[0], position[1] - 1, position[2]]
            : position;
        const removedPositions = isDoor
            ? [basePosition, [basePosition[0], basePosition[1] + 1, basePosition[2]]]
            : [position];

        set((state) => {
            const chunks = setBlocks(state.chunks, removedPositions.map((removed) => ({position: removed, blockId: null})));
            const removesFluidState = removedPositions.some((removed) => state.fluidLevels.has(positionKey(removed)));
            const fluidLevels = removesFluidState ? new Map(state.fluidLevels) : state.fluidLevels;
            if (removesFluidState) removedPositions.forEach((removed) => fluidLevels.delete(positionKey(removed)));
            const selectedStack = state.inventory[state.selectedHotbar];
            const itemId = miningDrop(blockId, selectedStack);
            let drops = state.gameMode === "survival" && itemId
                ? [...state.drops, {
                    id: nanoid(),
                    itemId,
                    count: 1,
                    position: [position[0], position[1] + 0.25, position[2]],
                    createdAt: Date.now(),
                }]
                : state.drops;
            let blockEntities = state.blockEntities;
            const entity = blockEntities.get(positionKey(position));
            if (entity) {
                blockEntities = new Map(blockEntities);
                const stored = entity.type === "chest" ? entity.slots : [entity.input, entity.fuel, entity.output];
                stored.filter(Boolean).forEach((stack) => {
                    drops = [...drops, {
                        id: nanoid(), itemId: stack.itemId, count: stack.count,
                        position: [position[0], position[1] + 0.25, position[2]], createdAt: Date.now(),
                    }];
                });
                blockEntities.delete(positionKey(position));
            }
            const removesBlockState = removedPositions.some((removed) => state.blockStates.has(positionKey(removed)));
            const blockStates = removesBlockState ? new Map(state.blockStates) : state.blockStates;
            if (removesBlockState) removedPositions.forEach((removed) => blockStates.delete(positionKey(removed)));
            const inventory = state.gameMode === "survival"
                ? damageTool(state.inventory, state.selectedHotbar)
                : state.inventory;
            return {
                chunks,
                drops,
                inventory,
                survivalInventory: state.gameMode === "survival" ? inventory : state.survivalInventory,
                blockEntities,
                blockStates,
                modelRevision: state.modelRevision + (BLOCK_BY_ID[blockId]?.modelId ? 1 : 0),
                lightSourceRevision: state.lightSourceRevision + (emittedLight(blockId) ? 1 : 0),
                blockLight: updateBlockLightInPlace(chunks, state.blockLight, removedPositions),
                soundEvent: {id: nanoid(), type: "break", blockId},
                particleEvent: {id: nanoid(), type: "break", position},
                goals: {...state.goals, blocksMined: (state.goals.blocksMined ?? 0) + 1},
                fluidLevels,
                fluidQueue: state.fluidQueue,
                chunkRevisions: bumpRevisions(state.chunkRevisions, removedPositions.flatMap(affectedChunkKeys)),
                dirtyChunks: dirtyPositions(state, removedPositions),
                activeChunkKeys: activeKeysAfterEdits(
                    state.activeChunkKeys,
                    chunks,
                    state.playerChunk[0],
                    state.playerChunk[1],
                    state.renderDistance,
                    removedPositions
                ),
            };
        });
        return true;
    },

    removeCubeSafely: (x, y, z) => {
        const position = [Math.round(x), Math.round(y), Math.round(z)];
        const state = get();
        const blockId = getBlock(state.chunks, position);
        const blockBelow = getBlock(state.chunks, [position[0], position[1] - 1, position[2]]);
        if (BLOCK_BY_ID[blockId]?.solid && !BLOCK_BY_ID[blockBelow]?.solid) {
            set({interactionFeedback: "That block has empty space below it and cannot be removed safely"});
            return false;
        }
        return state.removeCube(...position);
    },

    destroyBlockWithSelectedTool: (x, y, z) => {
        const state = get();
        const stack = state.inventory[state.selectedHotbar];
        if (!isDestructiveTool(stack ? ITEM_BY_ID[stack.itemId] : null)) return false;
        return state.removeCubeSafely(x, y, z);
    },

    destroyEntityWithSelectedTool: (id) => {
        const state = get();
        const stack = state.inventory[state.selectedHotbar];
        const tool = stack ? ITEM_BY_ID[stack.itemId] : null;
        if (!isDestructiveTool(tool)) return false;
        const entity = state.entities.find((candidate) => candidate.id === id);
        if (!entity || Math.hypot(
            entity.position[0] - state.playerPosition[0],
            entity.position[1] - state.playerPosition[1],
            entity.position[2] - state.playerPosition[2]
        ) > 6) return false;
        const inventory = state.gameMode === "survival"
            ? damageTool(state.inventory, state.selectedHotbar)
            : state.inventory;
        const entityTombstones = new Map(state.entityTombstones ?? []);
        entityTombstones.set(`${state.dimension}|${id}`, {
            entityId: id,
            dimension: state.dimension,
            chunkX: entity.chunk?.[0] ?? Math.floor(entity.position[0] / 16),
            chunkZ: entity.chunk?.[1] ?? Math.floor(entity.position[2] / 16),
            generated: !id.includes(":placed:"),
            deleted: true,
            state: null,
        });
        const deletedEntityIds = new Set(state.deletedEntityIds ?? []).add(id);
        set({
            entities: state.entities.filter((candidate) => candidate.id !== id),
            entityTombstones,
            deletedEntityIds,
            inventory,
            ...(state.gameMode === "survival" ? {survivalInventory: inventory} : {}),
            ...(state.mountedEntityId === id ? {mountedEntityId: null} : {}),
            creatureFeedback: `${CREATURE_TYPES[entity.type]?.name ?? "Entity"} removed`,
            soundEvent: {id: nanoid(), type: "break", blockId: entity.type},
            particleEvent: {id: nanoid(), type: "break", position: entity.position},
        });
        return true;
    },

    getBlock: (position) => getBlock(get().chunks, position),

    markChunkCollisionReady: (token, ready) => set((state) => {
        const collisionReadyChunkKeys = new Set(state.collisionReadyChunkKeys);
        if (ready) collisionReadyChunkKeys.add(token);
        else collisionReadyChunkKeys.delete(token);
        return {collisionReadyChunkKeys};
    }),

    processFluidStep: (allowLava = true) => {
        const result = processFluidUpdate(get(), allowLava);
        if (result.changedPositions.length === 0) {
            if (result.fluidQueue !== get().fluidQueue) {
                set({fluidQueue: result.fluidQueue});
            }
            return;
        }

        const revisedKeys = result.changedPositions.flatMap(affectedChunkKeys);
        set((state) => ({
            chunks: result.chunks,
            fluidLevels: result.fluidLevels,
            fluidQueue: result.fluidQueue,
            chunkRevisions: bumpRevisions(state.chunkRevisions, revisedKeys),
            dirtyChunks: dirtyPositions(state, result.changedPositions),
            activeChunkKeys: activeKeysAfterEdits(
                state.activeChunkKeys,
                result.chunks,
                state.playerChunk[0],
                state.playerChunk[1],
                state.renderDistance,
                result.changedPositions
            ),
        }));
    },

    setTexture: (texture) => {
        if (isBlockId(texture)) {
            const index = get().inventory.findIndex((stack, slot) => slot < 9 && stack?.itemId === texture);
            if (index >= 0) set({texture, selectedHotbar: index});
        }
    },

    selectHotbar: (index) => {
        if (!Number.isInteger(index) || index < 0 || index >= 9) return;
        const stack = get().inventory[index];
        const bridgeStyle = stack ? ITEM_BY_ID[stack.itemId]?.bridgeStyle : null;
        set((state) => ({
            selectedHotbar: index,
            ...(stack ? {texture: stack.itemId} : {}),
            ...(!bridgeStyle || bridgeStyle !== state.bridgeAnchor?.style ? {bridgeAnchor: null} : {}),
        }));
    },

    setInventory: (inventory) => set((state) => ({
        inventory,
        ...(state.gameMode === "survival" ? {survivalInventory: inventory} : {}),
    })),

    addCatalogItem: (itemId) => {
        if (!isItemId(itemId)) return false;
        const state = get();
        const item = ITEM_BY_ID[itemId];
        const result = addItem(state.inventory, itemId, item.maxStack);
        if (result.remainder > 0) {
            set({interactionFeedback: "Remove an inventory stack before adding this item"});
            return false;
        }
        set({inventory: result.slots, ...(state.gameMode === "survival" ? {survivalInventory: result.slots} : {})});
        return true;
    },

    removeInventorySlot: (index) => set((state) => {
        if (!Number.isInteger(index) || index < 0 || index >= state.inventory.length) return {};
        const inventory = state.inventory.slice();
        inventory[index] = null;
        return {inventory, ...(state.gameMode === "survival" ? {survivalInventory: inventory} : {})};
    }),

    moveInventoryStack: (from, to) => set((state) => {
        const inventory = transferStack(state.inventory, from, to);
        return {inventory, ...(state.gameMode === "survival" ? {survivalInventory: inventory} : {})};
    }),

    shiftInventoryStack: (index) => set((state) => {
        const inventory = shiftMove(state.inventory, index);
        return {inventory, ...(state.gameMode === "survival" ? {survivalInventory: inventory} : {})};
    }),

    toggleInventory: () => set((state) => ({inventoryOpen: !state.inventoryOpen})),
    closeInventory: () => set({inventoryOpen: false, station: null, stationPosition: null}),

    openBlockInterface: (position, blockId) => {
        if (blockId !== "crafting_table" && blockId !== "furnace" && blockId !== "chest" && blockId !== "enchanting_table") return false;
        set({inventoryOpen: true, station: blockId, stationPosition: [...position]});
        return true;
    },

    interactBlock: (position) => {
        const state = get();
        const blockId = getBlock(state.chunks, position);
        if (get().openBlockInterface(position, blockId)) {
            set({soundEvent: {id: nanoid(), type: "open", blockId}});
            return true;
        }
        if (blockId === "bed") {
            if (!isNightTime(state.worldTime)) {
                set({interactionFeedback: "You can rest when night arrives"});
                return true;
            }
            set({worldTime: nextMorningWorldTime(state.worldTime), interactionFeedback: "You rested until morning", soundEvent: {id: nanoid(), type: "rest"}});
            return true;
        }
        if (blockId === "portal") {
            get().travelDimension();
            return true;
        }
        if (blockId === "elevator") {
            const stops = [];
            for (let y = WORLD_MIN_Y + 1; y <= WORLD_MAX_Y; y += 1) {
                if (getBlock(state.chunks, [position[0], y, position[2]]) === "elevator") stops.push(y);
            }
            if (stops.length < 2) {
                set({interactionFeedback: "Add another elevator platform directly above or below this one"});
                return true;
            }
            const nextY = stops.find((y) => y > position[1]) ?? stops[0];
            set({
                teleportRequest: {id: nanoid(), position: [position[0], nextY + 1.05, position[2]]},
                interactionFeedback: `Elevator: floor ${stops.indexOf(nextY) + 1}`,
                soundEvent: {id: nanoid(), type: "toggle", blockId},
            });
            return true;
        }
        const toggled = toggleBlock(state.chunks, position);
        if (toggled) {
            const blockStates = new Map(state.blockStates);
            toggled.positions.forEach((changedPosition) => {
                const current = blockStates.get(positionKey(changedPosition)) ?? {};
                blockStates.set(positionKey(changedPosition), {...current, open: toggled.open});
            });
            set({
                chunks: toggled.chunks,
                blockStates,
                blockLight: updateBlockLightInPlace(toggled.chunks, state.blockLight, toggled.positions),
                chunkRevisions: bumpRevisions(state.chunkRevisions, toggled.positions.flatMap(affectedChunkKeys)),
                dirtyChunks: dirtyPositions(state, toggled.positions),
                soundEvent: {id: nanoid(), type: "toggle", blockId},
            });
            return true;
        }
        if (blockId === "switch") {
            const blockStates = new Map(state.blockStates);
            const current = blockStates.get(positionKey(position)) ?? {};
            const powered = !current.powered;
            blockStates.set(positionKey(position), {...current, powered});
            const propagated = propagateSwitch(state.chunks, position, powered);
            const revised = [position, ...propagated.changed].flatMap(affectedChunkKeys);
            set({
                chunks: propagated.chunks,
                blockStates,
                blockLight: updateBlockLightInPlace(propagated.chunks, state.blockLight, [position, ...propagated.changed]),
                lightSourceRevision: state.lightSourceRevision + (propagated.changed.length ? 1 : 0),
                chunkRevisions: bumpRevisions(state.chunkRevisions, revised),
                dirtyChunks: dirtyPositions(state, [position, ...propagated.changed]),
                soundEvent: {id: nanoid(), type: "switch"},
                particleEvent: {id: nanoid(), type: "power", position},
            });
            return true;
        }
        if (blockId === "crop_3") {
            const chunks = setBlock(state.chunks, position, "crop_0");
            const wheat = addItem(state.inventory, "wheat", 1);
            const seeds = addItem(wheat.slots, "seeds", 1);
            set({
                chunks,
                inventory: seeds.slots,
                ...(state.gameMode === "survival" ? {survivalInventory: seeds.slots} : {}),
                scheduledUpdates: [...state.scheduledUpdates, scheduleCrop(position)],
                chunkRevisions: bumpRevisions(state.chunkRevisions, affectedChunkKeys(position)),
                dirtyChunks: dirtyPositions(state, [position]),
                soundEvent: {id: nanoid(), type: "harvest"},
                particleEvent: {id: nanoid(), type: "harvest", position},
                goals: {...state.goals, harvests: (state.goals.harvests ?? 0) + 1},
            });
            return true;
        }
        return false;
    },

    applySelectedItemToBlock: (target, placement) => {
        const state = get();
        const stack = state.inventory[state.selectedHotbar];
        const item = stack ? ITEM_BY_ID[stack.itemId] : null;
        const targetId = getBlock(state.chunks, target);
        const requestedType = item?.creatureType ?? item?.vehicleType;
        const requestedDefinition = requestedType ? CREATURE_TYPES[requestedType] : null;
        const aquaticPlacement = requestedDefinition?.aquatic && targetId === "water";
        const watercraftRadius = requestedDefinition?.placementRadius ?? 0;
        const clearOfPlayer = Math.hypot(
            target[0] - state.playerPosition[0],
            target[2] - state.playerPosition[2]
        ) >= watercraftRadius;
        const clearOfWatercraft = state.entities.every((entity) => {
            const definition = CREATURE_TYPES[entity.type];
            if (!definition?.watercraft) return true;
            return Math.hypot(target[0] - entity.position[0], target[2] - entity.position[2])
                >= watercraftRadius + (definition.placementRadius ?? 0);
        });
        const watercraftPlacement = requestedDefinition?.watercraft && targetId === "water"
            && clearOfPlayer && clearOfWatercraft;
        if (requestedDefinition?.watercraft && targetId === "water" && !watercraftPlacement) {
            set({creatureFeedback: `Place the ${requestedDefinition.name.toLowerCase()} a little farther away`});
            return false;
        }
        const groundPlacement = requestedDefinition && !requestedDefinition.aquatic && !requestedDefinition.watercraft
            && placement[1] > target[1] && !getBlock(state.chunks, placement);
        if (requestedType && (aquaticPlacement || watercraftPlacement || groundPlacement)) {
            const type = requestedType;
            const entityPosition = aquaticPlacement
                ? [target[0], target[1], target[2]]
                : watercraftPlacement
                    ? [target[0], target[1] + (requestedDefinition.groundOffset ?? 0.5), target[2]]
                    : [placement[0], target[1] + (requestedDefinition.groundOffset ?? 0.5), placement[2]];
            const entity = {
                id: `${type}:placed:${nanoid()}`, type,
                position: entityPosition,
                velocity: [0, 0, 0], health: requestedDefinition.maxHealth,
                animationState: "happy", heading: 0, friendLevel: 1, followUntil: item.creatureType ? Date.now() + 45000 : 0,
                lastInteraction: Date.now(), lastGift: 0, persistent: true,
                chunk: [chunkCoordinate(placement[0]), chunkCoordinate(placement[2])],
            };
            set({entities: [...state.entities, entity], creatureFeedback: `${CREATURE_TYPES[type].name} is ready`, soundEvent: {id: nanoid(), type: "creature"}});
            return true;
        }
        if (item?.toolType === "hoe" && (targetId === "dirt" || targetId === "grass") && placement[1] > target[1]) {
            const chunks = setBlock(state.chunks, target, "farmland");
            const inventory = state.gameMode === "survival" ? damageTool(state.inventory, state.selectedHotbar) : state.inventory;
            set({chunks, inventory, survivalInventory: state.gameMode === "survival" ? inventory : state.survivalInventory, chunkRevisions: bumpRevisions(state.chunkRevisions, affectedChunkKeys(target)), dirtyChunks: dirtyPositions(state, [target]), soundEvent: {id: nanoid(), type: "till"}, particleEvent: {id: nanoid(), type: "till", position: target}});
            return true;
        }
        if (item?.id === "seeds" && targetId === "farmland" && placement[1] > target[1] && !getBlock(state.chunks, placement)) {
            const chunks = setBlock(state.chunks, placement, "crop_0");
            const inventory = state.gameMode === "creative" ? state.inventory : consumeItem(state.inventory, state.selectedHotbar, 1);
            set({chunks, inventory: inventory ?? state.inventory, survivalInventory: state.gameMode === "survival" ? (inventory ?? state.inventory) : state.survivalInventory, scheduledUpdates: [...state.scheduledUpdates, scheduleCrop(placement)], chunkRevisions: bumpRevisions(state.chunkRevisions, affectedChunkKeys(placement)), dirtyChunks: dirtyPositions(state, [placement]), soundEvent: {id: nanoid(), type: "plant"}, particleEvent: {id: nanoid(), type: "plant", position: placement}});
            return true;
        }
        return false;
    },

    setChestSlots: (position, slots, expectedRevision) => {
        const key = positionKey(position);
        const current = get().blockEntities.get(key);
        if (!current || current.type !== "chest" || current.revision !== expectedRevision || slots.length !== 27) return false;
        const blockEntities = new Map(get().blockEntities);
        blockEntities.set(key, {...current, slots, revision: current.revision + 1});
        set((state) => ({blockEntities, dirtyChunks: dirtyPositions(state, [position])}));
        return true;
    },

    enchantSelectedTool: () => {
        const state = get();
        const stack = state.inventory[state.selectedHotbar];
        if (!stack || !ITEM_BY_ID[stack.itemId]?.toolType) return false;
        const crystalIndex = state.inventory.findIndex((value) => value?.itemId === "crystal");
        if (state.gameMode === "survival" && crystalIndex < 0) return false;
        const inventory = state.inventory.map((value) => value ? {...value} : null);
        inventory[state.selectedHotbar] = {...stack, enchantments: {efficiency: 1, unbreaking: 1}};
        if (state.gameMode === "survival") {
            const consumed = consumeItem(inventory, crystalIndex, 1);
            if (consumed) inventory.splice(0, inventory.length, ...consumed);
        }
        set({inventory, ...(state.gameMode === "survival" ? {survivalInventory: inventory} : {}), interactionFeedback: `${ITEM_BY_ID[stack.itemId].name} gained Efficiency and Durability`, goals: {...state.goals, enchanted: (state.goals.enchanted ?? 0) + 1}});
        return true;
    },

    processScheduledUpdates: (now = Date.now()) => set((state) => {
        if (!state.gameRules.cropGrowth) return {};
        let chunks = state.chunks;
        const pending = [];
        const changed = [];
        state.scheduledUpdates.forEach((update) => {
            if (update.due > now) { pending.push(update); return; }
            if (update.type !== "crop") return;
            const result = growCrop(chunks, update.position);
            chunks = result.chunks;
            if (result.changed) changed.push(update.position);
            if (isCrop(getBlock(chunks, update.position)) && getBlock(chunks, update.position) !== "crop_3") {
                pending.push(scheduleCrop(update.position, now + 30000));
            }
        });
        if (!changed.length) return {scheduledUpdates: pending};
        return {chunks, scheduledUpdates: pending, blockLight: updateBlockLightInPlace(chunks, state.blockLight, changed), chunkRevisions: bumpRevisions(state.chunkRevisions, changed.flatMap(affectedChunkKeys)), dirtyChunks: dirtyPositions(state, changed)};
    }),

    setCraftingGrid: (kind, grid) => {
        if (kind === "player" && grid.length === 4) set({playerCrafting: grid});
        if (kind === "table" && grid.length === 9) set({tableCrafting: grid});
    },

    craftItem: (kind) => {
        const state = get();
        const grid = kind === "table" ? state.tableCrafting : state.playerCrafting;
        const size = kind === "table" ? 3 : 2;
        const recipe = findCraftingRecipe(grid, size);
        if (!recipe) return false;
        const added = addItem(state.inventory, recipe.result.itemId, recipe.result.count);
        if (added.remainder > 0) return false;
        const nextGrid = consumeRecipe(grid, recipe);
        set({
            inventory: added.slots,
            ...(state.gameMode === "survival" ? {survivalInventory: added.slots} : {}),
            [kind === "table" ? "tableCrafting" : "playerCrafting"]: nextGrid,
            goals: {...state.goals, crafted: (state.goals.crafted ?? 0) + recipe.result.count},
        });
        return true;
    },

    setFurnaceSlots: (position, slots) => set((state) => {
        const key = positionKey(position);
        const current = state.blockEntities.get(key) ?? createFurnace();
        const input = slots[0];
        const fuel = slots[1];
        if (input && !SMELTING_RECIPES[input.itemId]) return {};
        if (fuel && !FUEL_TIME[fuel.itemId]) return {};
        const blockEntities = new Map(state.blockEntities);
        blockEntities.set(key, {...current, input, fuel, output: slots[2], lastUpdated: Date.now()});
        return {blockEntities, dirtyChunks: dirtyPositions(state, [position])};
    }),

    processFurnaces: (now = Date.now()) => set((state) => {
        if (state.blockEntities.size === 0) return {};
        const blockEntities = new Map(state.blockEntities);
        const changedPositions = [];
        blockEntities.forEach((entity, key) => {
            if (entity.type !== "chest") {
                const next = advanceFurnace(entity, now);
                blockEntities.set(key, next);
                if (next !== entity) changedPositions.push(key.split(",").map(Number));
            }
        });
        return {blockEntities, ...(changedPositions.length ? {dirtyChunks: dirtyPositions(state, changedPositions)} : {})};
    }),

    setWorldTime: (worldTime) => set((state) => {
        if (!isNightTime(worldTime)) return {worldTime};
        let entities = state.entities;
        const spawnedCreatureGroups = new Set(state.spawnedCreatureGroups);
        const columns = new Set(state.activeChunkKeys.map((key) => {
            const [chunkX, , chunkZ] = parseChunkKey(key);
            return columnKey(chunkX, chunkZ);
        }));
        if (state.gameRules.creatures) columns.forEach((key) => {
            const group = `${key}:night`;
            if (spawnedCreatureGroups.has(group)) return;
            const [chunkX, chunkZ] = key.split(",").map(Number);
            const spawned = spawnCreaturesForColumn(state.seed, chunkX, chunkZ, state.playerPosition, true)
                .filter((entity) => (state.blockLight.get(positionKey(entity.position.map(Math.round))) ?? 0) < 8);
            entities = appendUniqueEntities(state, entities, spawned);
            spawnedCreatureGroups.add(group);
        });
        return {worldTime, entities, spawnedCreatureGroups};
    }),
    setDayPeriod: (period) => {
        const state = get();
        set({gameRules: {...state.gameRules, dayCycle: false}});
        get().setWorldTime(worldTimeForDayPeriod(period, state.worldTime));
    },
    setSkyWeather: (skyWeather, transitionSeconds = 2) => set((state) => ({
        skyWeather: normalizeWeather(skyWeather),
        skyWeatherTransitionSeconds: Math.max(0, Number(transitionSeconds) || 0),
        gameRules: {...state.gameRules, weather: true},
    })),

    updateCreatures: (now = Date.now(), deltaSeconds = 0.2) => set((state) => {
        let entities = uniqueEntities(state.entities).map((entity) => updateCreature(entity, state, now, deltaSeconds));
        if (entities.length > 192) {
            entities = entities.filter((entity) => entity.persistent || Math.hypot(
                entity.position[0] - state.playerPosition[0],
                entity.position[2] - state.playerPosition[2]
            ) <= 96).slice(-192);
        }
        return {entities};
    }),

    interactCreature: (id, now = Date.now()) => {
        const state = get();
        const index = state.entities.findIndex((entity) => entity.id === id);
        if (index < 0) return false;
        const entity = state.entities[index];
        if (Math.hypot(
            entity.position[0] - state.playerPosition[0],
            entity.position[1] - state.playerPosition[1],
            entity.position[2] - state.playerPosition[2]
        ) > 6) return false;
        if (entity.type === "villager") {
            const entities = state.entities.slice();
            entities[index] = {...entity, lastInteraction: now, animationState: "happy"};
            set({entities, villagerPanelId: id, inventoryOpen: false, creatureFeedback: `${entity.name} the ${entity.profession} welcomes you`});
            return true;
        }
        if (CREATURE_TYPES[entity.type]?.rideable) {
            const mounting = state.mountedEntityId !== id;
            const riderOffset = CREATURE_TYPES[entity.type].riderOffset ?? 0.55;
            set({
                mountedEntityId: mounting ? id : null,
                teleportRequest: mounting ? {id: nanoid(), position: [entity.position[0], entity.position[1] + riderOffset, entity.position[2]]} : null,
                creatureFeedback: mounting ? `Riding ${CREATURE_TYPES[entity.type].name} · Shift to dismount` : `Dismounted ${CREATURE_TYPES[entity.type].name}`,
            });
            return true;
        }
        const interaction = interactWithCreature(entity, now);
        if (!interaction.changed) return false;
        const entities = state.entities.slice();
        const selectedStack = state.inventory[state.selectedHotbar];
        const offeredWheat = selectedStack?.itemId === "wheat";
        entities[index] = offeredWheat
            ? {...interaction.entity, friendLevel: Math.min(5, interaction.entity.friendLevel + 1), followUntil: now + 90000}
            : interaction.entity;
        const inventoryAfterGift = interaction.gift
            ? addItem(state.inventory, interaction.gift, 1).slots
            : state.inventory;
        const inventory = offeredWheat && state.gameMode === "survival"
            ? (consumeItem(inventoryAfterGift, state.selectedHotbar, 1) ?? inventoryAfterGift)
            : inventoryAfterGift;
        set({
            entities,
            inventory,
            ...(state.gameMode === "survival" ? {survivalInventory: inventory} : {}),
            creatureFeedback: offeredWheat
                ? `${CREATURE_TYPES[entity.type].name} enjoyed your wheat and will follow longer`
                : interaction.gift
                ? `${CREATURE_TYPES[entity.type].name} became your friend and gave you ${ITEM_BY_ID[interaction.gift].name}`
                : `${CREATURE_TYPES[entity.type].name} is happy to see you`,
            soundEvent: {id: nanoid(), type: "creature"},
            goals: {...state.goals, friendships: Math.max(state.goals.friendships ?? 0, entities[index].friendLevel)},
        });
        return true;
    },

    clearCreatureFeedback: () => set({creatureFeedback: ""}),
    closeVillagerPanel: () => set({villagerPanelId: null}),
    tradeWithVillager: () => {
        const state = get();
        const villager = state.entities.find((entity) => entity.id === state.villagerPanelId && entity.type === "villager");
        if (!villager?.trade) return false;
        const {costItem, costCount, rewardItem, rewardCount} = villager.trade;
        if (state.gameMode === "survival" && itemCount(state.inventory, costItem) < costCount) {
            set({creatureFeedback: `You need ${costCount} ${ITEM_BY_ID[costItem]?.name ?? costItem}`});
            return false;
        }
        const paid = state.gameMode === "survival" ? removeItems(state.inventory, costItem, costCount) : state.inventory;
        const rewarded = addItem(paid, rewardItem, rewardCount);
        if (rewarded.remainder) return false;
        const entities = state.entities.map((entity) => entity.id === villager.id
            ? {...entity, friendLevel: Math.min(5, entity.friendLevel + 1), animationState: "happy"}
            : entity);
        set({entities, inventory: rewarded.slots, ...(state.gameMode === "survival" ? {survivalInventory: rewarded.slots} : {}), creatureFeedback: `${villager.name} completed the trade`});
        return true;
    },
    completeVillagerTask: () => {
        const state = get();
        const villager = state.entities.find((entity) => entity.id === state.villagerPanelId && entity.type === "villager");
        if (!villager?.task || villager.task.complete) return false;
        const task = villager.task;
        if (state.gameMode === "survival" && itemCount(state.inventory, task.itemId) < task.count) {
            set({creatureFeedback: `Bring ${task.count} ${ITEM_BY_ID[task.itemId]?.name ?? task.itemId}`});
            return false;
        }
        const supplied = state.gameMode === "survival" ? removeItems(state.inventory, task.itemId, task.count) : state.inventory;
        const rewarded = addItem(supplied, task.rewardItem, task.rewardCount);
        if (rewarded.remainder) return false;
        const entities = state.entities.map((entity) => entity.id === villager.id
            ? {...entity, friendLevel: Math.min(5, entity.friendLevel + 2), task: {...entity.task, complete: true}, animationState: "happy"}
            : entity);
        set({entities, inventory: rewarded.slots, ...(state.gameMode === "survival" ? {survivalInventory: rewarded.slots} : {}), creatureFeedback: `${villager.name} thanks you for helping the community`, goals: {...state.goals, villageTasks: (state.goals.villageTasks ?? 0) + 1}});
        return true;
    },
    dismount: () => set((state) => ({mountedEntityId: null, creatureFeedback: state.mountedEntityId ? "Dismounted" : state.creatureFeedback})),
    clearInteractionFeedback: () => set({interactionFeedback: ""}),
    emitSound: (type, blockId = null) => set({soundEvent: {id: nanoid(), type, blockId}}),

    setGameMode: (gameMode) => {
        if (gameMode !== "survival" && gameMode !== "creative") return;
        set((state) => gameMode === "creative"
            ? {gameMode, survivalInventory: state.inventory, inventory: creativeInventory()}
            : {gameMode, inventory: state.survivalInventory}
        );
    },

    setRenderDistance: (renderDistance) => {
        if (!Number.isInteger(renderDistance) || renderDistance < 1 || renderDistance > MAX_RENDER_DISTANCE) return false;
        set({renderDistance});
        return true;
    },

    updateDrops: (now = Date.now()) => set((state) => {
        let inventory = state.inventory;
        const drops = [];
        let collected = false;
        state.drops.forEach((drop) => {
            if (now - drop.createdAt >= 300000) return;
            const offset = state.playerPosition.map((value, index) => value - drop.position[index]);
            const distance = Math.hypot(...offset);
            if (distance <= 1.25) {
                const result = addItem(inventory, drop.itemId, drop.count);
                inventory = result.slots;
                collected = true;
                return;
            }
            if (distance <= 5 && distance > 0) {
                const step = Math.min(0.35, distance - 1.2);
                drops.push({...drop, position: drop.position.map((value, index) => (
                    value + offset[index] / distance * step
                ))});
            } else {
                drops.push(drop);
            }
        });
        return {
            drops,
            inventory,
            ...(state.gameMode === "survival" ? {survivalInventory: inventory} : {}),
            ...(collected ? {soundEvent: {id: nanoid(), type: "pickup"}} : {}),
        };
    }),

    setPlayerPosition: (position, heading = null) => {
        const playerChunk = [chunkCoordinate(position[0]), chunkCoordinate(position[2])];
        const previousChunk = get().playerChunk;
        const exploredColumns = new Set(get().exploredColumns);
        exploredColumns.add(`${get().dimension}:${columnKey(...playerChunk)}`);
        const discoveredBiomes = new Set(get().discoveredBiomes);
        discoveredBiomes.add(`${get().dimension}:${biomeAt(get().seed, position[0], position[2])}`);
        const entities = get().mountedEntityId ? get().entities.map((entity) => entity.id === get().mountedEntityId
            ? {
                ...entity,
                position: [position[0], position[1] - (CREATURE_TYPES[entity.type]?.riderOffset ?? 0.55), position[2]],
                chunk: playerChunk,
                animationState: "walking",
                ...(Number.isFinite(heading) ? {heading} : {}),
            }
            : entity) : get().entities;
        set({
            playerPosition: position,
            entities,
            exploredColumns,
            discoveredBiomes,
            goals: {...get().goals, explored: exploredColumns.size},
            ...(previousChunk[0] !== playerChunk[0] || previousChunk[1] !== playerChunk[1]
                ? {playerChunk}
                : {}),
        });
    },

    hydrateRemoteWorld: (payload, worlds = []) => {
        const saved = documentFromBootstrap(payload);
        if (!saved) throw new Error("The database world document is missing or invalid");
        const seed = saved.seed;
        const playerPosition = saved.playerPosition ?? spawnPosition(seed);
        const generatedMarkers = generatedWorldMarkers(seed);
        const markers = [...(payload.markers?.length ? payload.markers : saved.markers ?? [])]
            .filter((marker) => marker.id !== "generated-nearest-stadium");
        generatedMarkers.forEach((marker) => {
            if (!markers.some((existing) => existing.id === marker.id)) markers.push(marker);
        });
        set((state) => ({
            seed,
            worldUid: payload.world.id,
            worldName: payload.world.name,
            worldCreatedAt: Date.parse(payload.world.createdAt) || Date.now(),
            worlds,
            texture: saved.texture ?? DEFAULT_BLOCK_ID,
            chunks: new Map(),
            generatedColumns: new Set(),
            chunkRevisions: new Map(),
            fluidLevels: new Map(),
            fluidQueue: [],
            inventory: catalogInventory(saved.inventory),
            survivalInventory: catalogInventory(saved.survivalInventory ?? saved.inventory),
            selectedHotbar: saved.selectedHotbar ?? 0,
            gameMode: saved.gameMode ?? "survival",
            renderDistance: saved.renderDistance ?? RENDER_DISTANCE,
            inventoryOpen: false,
            drops: saved.drops ?? [],
            playerCrafting: saved.playerCrafting ?? Array(4).fill(null),
            tableCrafting: saved.tableCrafting ?? Array(9).fill(null),
            blockEntities: new Map(),
            blockStates: new Map(),
            scheduledUpdates: [],
            blockLight: new Map(),
            station: null,
            stationPosition: null,
            entities: [],
            spawnedCreatureGroups: new Set(),
            worldTime: saved.worldTime ?? 0,
            skyWeather: normalizeWeather(saved.skyWeather),
            dimension: saved.dimension ?? "overworld",
            dimensionSnapshots: saved.dimensionSnapshots ?? new Map(),
            exploredColumns: new Set((payload.exploredColumns ?? []).map((item) => `${item.dimension}:${item.chunkX},${item.chunkZ}`)),
            discoveredBiomes: new Set((payload.discoveredBiomes ?? []).map((item) => `${item.dimension}:${item.biomeId}`)),
            markers,
            discoveredStructures: (payload.discoveredStructures ?? []).map((item) => item.data),
            goals: saved.goals ?? {},
            gameRules: saved.gameRules ?? {dayCycle: true, weather: true, creatures: true, cropGrowth: true},
            enabledPacks: payload.dataPacks?.length ? payload.dataPacks.map((pack) => pack.namespace) : saved.enabledPacks ?? [],
            entitiesLoaded: false,
            mountedEntityId: payload.player?.state?.mountedEntityId ?? null,
            playerPosition,
            playerChunk: [chunkCoordinate(playerPosition[0]), chunkCoordinate(playerPosition[2])],
            spawn: spawnPosition(seed),
            worldId: state.worldId + 1,
            activeChunkKeys: [],
            collisionReadyChunkKeys: new Set(),
            bridgeAnchor: null,
            persistenceReady: true,
            persistenceRevision: payload.world.revision,
            persistenceIncarnationId: payload.world.incarnationId,
            persistencePositionVersion: payload.player?.positionVersion ?? 0,
            persistenceConflict: false,
            persistenceSuspended: false,
            dirtyChunks: new Map(),
            entityTombstones: new Map(),
            deletedEntityIds: new Set(),
            remoteAuthoritativeChunks: new Set(),
            remoteLoadedColumns: new Set(),
            saveStatus: "World loaded",
        }));
    },

    loadRemoteRegion: async (centerX, centerZ, distance) => {
        const state = get();
        if (!state.persistenceReady) return true;
        const edge = Math.ceil(distance);
        const requested = [];
        for (let x = centerX - edge; x <= centerX + edge; x += 1) {
            for (let z = centerZ - edge; z <= centerZ + edge; z += 1) requested.push(`${state.dimension}:${x},${z}`);
        }
        if (requested.every((key) => state.remoteLoadedColumns.has(key))) return true;
        const identity = {worldUid: state.worldUid, dimension: state.dimension, worldId: state.worldId};
        const requestedDirtyVersions = new Map(state.dirtyChunks);
        const response = await worldApi.region(state.worldUid, {
            dimension: state.dimension, minX: centerX - edge, maxX: centerX + edge,
            minZ: centerZ - edge, maxZ: centerZ + edge,
        });
        const current = get();
        if (current.worldUid !== identity.worldUid || current.dimension !== identity.dimension || current.worldId !== identity.worldId) return false;
        const safeChunks = response.chunks.filter((record) => {
            const key = persistenceChunkKey(identity.dimension, `${record.chunkX},${record.chunkY},${record.chunkZ}`);
            return current.dirtyChunks.get(key) === requestedDirtyVersions.get(key);
        });
        const merged = applyRemoteChunks(current, identity.dimension, safeChunks, response.entities);
        const remoteLoadedColumns = new Set(current.remoteLoadedColumns);
        requested.forEach((key) => remoteLoadedColumns.add(key));
        const revised = safeChunks.map((record) => `${record.chunkX},${record.chunkY},${record.chunkZ}`).flatMap(neighboringChunkKeys);
        set({
            ...merged,
            remoteLoadedColumns,
            chunkRevisions: bumpRevisions(current.chunkRevisions, revised),
            blockLight: rebuildBlockLight(merged.chunks),
        });
        return true;
    },

    markAllChunksDirty: () => set((state) => {
        const dirtyChunks = new Map(state.dirtyChunks);
        allPersistentChunkKeys(state).forEach((key) => dirtyChunks.set(key, (dirtyChunks.get(key) ?? 0) + 1));
        return {dirtyChunks};
    }),

    saveWorld: async (reason = "manual") => {
        if (get().persistenceSuspended) return false;
        if (!get().persistenceReady) {
            try {
                writeWorld(get());
                set({saveStatus: reason === "auto" ? "Autosaved" : reason === "fresh" ? "Fresh world saved" : "World saved", worlds: worldCatalog()});
                return true;
            } catch {
                set({saveStatus: "World is too large for browser storage"});
                return false;
            }
        }
        if (get().persistenceConflict) return false;
        if (pendingRemoteSave) {
            await pendingRemoteSave;
            if (reason === "manual" && get().dirtyChunks.size) return get().saveWorld(reason);
            return !get().persistenceConflict;
        }
        const positionVersion = get().persistencePositionVersion + 1;
        set({persistencePositionVersion: positionVersion, saveStatus: reason === "auto" ? "Saving…" : "Saving world…"});
        const snapshot = get();
        const dirtyVersions = new Map(snapshot.dirtyChunks);
        const tombstoneVersions = new Map(snapshot.entityTombstones);
        const batchId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : nanoid();
        const payload = buildAutosavePayload(snapshot, batchId, positionVersion);
        const request = worldApi.autosave(snapshot.worldUid, payload);
        pendingRemoteSave = request;
        try {
            const result = await request;
            if (get().worldUid !== snapshot.worldUid || get().persistenceIncarnationId !== snapshot.persistenceIncarnationId) return false;
            set((state) => {
                const dirtyChunks = new Map(state.dirtyChunks);
                dirtyVersions.forEach((version, key) => {
                    if (dirtyChunks.get(key) === version) dirtyChunks.delete(key);
                });
                const entityTombstones = new Map(state.entityTombstones);
                tombstoneVersions.forEach((value, key) => {
                    if (entityTombstones.get(key) === value) entityTombstones.delete(key);
                });
                return {
                    dirtyChunks,
                    entityTombstones,
                    persistenceRevision: result.revision,
                    saveStatus: reason === "auto" ? "Autosaved" : reason === "fresh" ? "Fresh world saved" : "World saved",
                };
            });
            return true;
        } catch (error) {
            if (get().worldUid !== snapshot.worldUid || get().persistenceIncarnationId !== snapshot.persistenceIncarnationId) return false;
            const conflict = error.code === "REVISION_CONFLICT" || error.code === "WORLD_RESET";
            set({persistenceConflict: conflict, saveStatus: conflict ? "Save conflict · reload or export this world" : `Not saved · ${error.message}`});
            return false;
        } finally {
            if (pendingRemoteSave === request) pendingRemoteSave = null;
        }
    },

    savePlayerPosition: async (keepalive = false) => {
        const state = get();
        if (!state.persistenceReady) return false;
        const positionVersion = state.persistencePositionVersion + 1;
        set({persistencePositionVersion: positionVersion});
        try {
            await worldApi.savePlayer(state.worldUid, {incarnationId: state.persistenceIncarnationId, position: state.playerPosition, positionVersion}, keepalive);
            return true;
        } catch {
            return false;
        }
    },

    createWorld: async (requestedSeed, requestedName = null, requestedId = null) => {
        const current = get();
        const remote = current.persistenceReady;
        const worldUid = requestedId ?? current.worldUid;
        const worldName = String(requestedName ?? current.worldName).trim() || "My World";
        const seed = String(requestedSeed).trim() || DEFAULT_WORLD_SEED;
        const spawn = spawnPosition(seed);
        const generatedMarkers = generatedWorldMarkers(seed);
        if (!remote) clearSavedWorld(worldUid);
        set((state) => ({
            seed,
            worldUid,
            worldName,
            worldCreatedAt: Date.now(),
            texture: DEFAULT_BLOCK_ID,
            chunks: new Map(),
            generatedColumns: new Set(),
            chunkRevisions: new Map(),
            fluidLevels: new Map(),
            fluidQueue: [],
            inventory: creativeInventory(),
            survivalInventory: creativeInventory(),
            selectedHotbar: 0,
            gameMode: "survival",
            renderDistance: state.renderDistance,
            inventoryOpen: false,
            drops: [],
            playerCrafting: Array(4).fill(null),
            tableCrafting: Array(9).fill(null),
            blockEntities: new Map(),
            blockStates: new Map(),
            scheduledUpdates: [],
            blockLight: new Map(),
            station: null,
            stationPosition: null,
            entities: [],
            spawnedCreatureGroups: new Set(),
            worldTime: 0,
            skyWeather: "sunny",
            dimension: "overworld",
            dimensionSnapshots: new Map(),
            exploredColumns: new Set(),
            discoveredBiomes: new Set(),
            markers: generatedMarkers,
            discoveredStructures: [],
            goals: {},
            gameRules: {dayCycle: true, weather: true, creatures: true, cropGrowth: true},
            enabledPacks: [],
            debugOpen: false,
            mapOpen: false,
            worldManagerOpen: false,
            creatureFeedback: "",
            villagerPanelId: null,
            mountedEntityId: null,
            teleportRequest: null,
            interactionFeedback: "",
            soundEvent: null,
            particleEvent: null,
            activeChunkKeys: [],
            collisionReadyChunkKeys: new Set(),
            bridgeAnchor: null,
            playerPosition: spawn,
            playerChunk: [chunkCoordinate(spawn[0]), chunkCoordinate(spawn[2])],
            spawn,
            worldId: state.worldId + 1,
            saveStatus: "New world created",
            persistenceReady: !remote && state.persistenceReady,
            persistenceConflict: false,
            persistenceSuspended: remote,
            dirtyChunks: new Map(),
            entityTombstones: new Map(),
            deletedEntityIds: new Set(),
            remoteAuthoritativeChunks: new Set(),
            remoteLoadedColumns: new Set(),
        }));
        if (!remote) return get().saveWorld("fresh");
        try {
            const fresh = get();
            const world = await worldApi.reset(current.worldUid, {
                seed,
                settings: {document: remoteDocument(fresh)},
                player: {position: fresh.playerPosition, positionVersion: current.persistencePositionVersion + 1, state: {mountedEntityId: null}},
            });
            set({
                persistenceReady: true,
                persistenceRevision: world.revision,
                persistenceIncarnationId: world.incarnationId,
                persistencePositionVersion: current.persistencePositionVersion + 1,
                persistenceSuspended: false,
                saveStatus: "Fresh world saved",
            });
            await get().refreshWorlds();
            return true;
        } catch (error) {
            set({saveStatus: `World reset failed · ${error.message}`, persistenceSuspended: false});
            await get().openRemoteWorld(current.worldUid, false).catch(() => {});
            return false;
        }
    },

    refreshWorlds: async () => {
        const result = await worldApi.list();
        set({worlds: result.worlds});
        return result.worlds;
    },

    openRemoteWorld: async (worldUid, flush = true) => {
        if (flush && get().persistenceReady && !(await get().saveWorld("manual"))) return false;
        const worlds = await get().refreshWorlds();
        const payload = await worldApi.load(worldUid);
        get().hydrateRemoteWorld(payload, worlds);
        const state = get();
        await state.loadRemoteRegion(state.playerChunk[0], state.playerChunk[1], state.renderDistance);
        return true;
    },

    createManagedWorld: async (name, requestedSeed) => {
        if (get().persistenceReady && !(await get().saveWorld("manual"))) throw new Error("The current world could not be saved");
        const seed = String(requestedSeed).trim() || DEFAULT_WORLD_SEED;
        const worldUid = `world-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const position = spawnPosition(seed);
        const base = get();
        const document = remoteDocument({
            ...base, seed, worldUid, worldName: String(name).trim() || "New World", playerPosition: position,
            chunks: new Map(), generatedColumns: new Set(), fluidLevels: new Map(), blockEntities: new Map(),
            blockStates: new Map(), scheduledUpdates: [], entities: [], spawnedCreatureGroups: new Set(),
            dimensionSnapshots: new Map(), exploredColumns: new Set(), discoveredBiomes: new Set(),
            discoveredStructures: [], markers: generatedWorldMarkers(seed), goals: {}, worldTime: 0, skyWeather: "sunny",
            inventory: creativeInventory(), survivalInventory: creativeInventory(), enabledPacks: [],
        });
        await worldApi.create({id: worldUid, name: String(name).trim() || "New World", seed, settings: {document}, player: {position, positionVersion: 0, state: {mountedEntityId: null}}});
        return get().openRemoteWorld(worldUid, false);
    },

    toggleDebug: () => set((state) => ({debugOpen: !state.debugOpen})),
    toggleMap: () => set((state) => ({mapOpen: !state.mapOpen})),
    toggleWorldManager: () => set((state) => ({worldManagerOpen: !state.worldManagerOpen})),
    addMarker: (name) => set((state) => ({markers: [...state.markers, {id: nanoid(), name: String(name).trim() || "Marker", position: state.playerPosition.map(Math.round), dimension: state.dimension, color: "#ffd45c"}]})),
    removeMarker: (id) => set((state) => ({markers: state.markers.filter((marker) => marker.id !== id)})),
    togglePacks: () => set((state) => ({packsOpen: !state.packsOpen})),
    setGameRule: (rule, value) => set((state) => ({gameRules: {...state.gameRules, [rule]: Boolean(value)}})),
    importDataPack: async (serialized) => {
        let pack;
        try { pack = JSON.parse(serialized); } catch { return {ok: false, errors: ["The pack is not valid JSON"]}; }
        const result = registerDataPack(pack);
        if (!result.ok) return result;
        if (get().persistenceReady) await worldApi.savePack(pack);
        else saveDataPack(pack);
        set((state) => ({enabledPacks: Array.from(new Set([...state.enabledPacks, pack.namespace])), inventory: catalogInventory(state.inventory), interactionFeedback: `Enabled data pack ${pack.namespace}`}));
        return result;
    },

    travelDimension: () => set((state) => {
        const target = state.dimension === "overworld" ? "dream_grove" : "overworld";
        const dimensionSnapshots = new Map(state.dimensionSnapshots);
        dimensionSnapshots.set(state.dimension, {
            chunks: state.chunks, generatedColumns: state.generatedColumns, fluidLevels: state.fluidLevels,
            blockEntities: state.blockEntities, blockStates: state.blockStates, scheduledUpdates: state.scheduledUpdates,
            entities: state.entities, spawnedCreatureGroups: state.spawnedCreatureGroups, worldTime: state.worldTime,
            playerPosition: state.playerPosition,
        });
        const saved = dimensionSnapshots.get(target);
        const targetSeed = target === "overworld" ? state.seed : `${state.seed}:dream-grove`;
        const playerPosition = saved?.playerPosition ?? spawnPosition(targetSeed);
        const targetChunks = saved?.chunks ?? setBlock(new Map(), [playerPosition[0] + 2, playerPosition[1] - 1, playerPosition[2]], "portal");
        return {
            dimension: target,
            dimensionSnapshots,
            chunks: targetChunks,
            generatedColumns: saved?.generatedColumns ?? new Set(),
            fluidLevels: saved?.fluidLevels ?? new Map(),
            fluidQueue: [],
            blockEntities: saved?.blockEntities ?? new Map(),
            blockStates: saved?.blockStates ?? new Map(),
            scheduledUpdates: saved?.scheduledUpdates ?? [],
            entities: saved?.entities ?? [],
            spawnedCreatureGroups: saved?.spawnedCreatureGroups ?? new Set(),
            worldTime: saved?.worldTime ?? state.worldTime,
            playerPosition,
            playerChunk: [chunkCoordinate(playerPosition[0]), chunkCoordinate(playerPosition[2])],
            spawn: spawnPosition(targetSeed),
            chunkRevisions: new Map(), activeChunkKeys: [], blockLight: rebuildBlockLight(targetChunks),
            collisionReadyChunkKeys: new Set(),
            bridgeAnchor: null,
            worldId: state.worldId + 1,
            villagerPanelId: null,
            mountedEntityId: null,
            teleportRequest: null,
            interactionFeedback: target === "dream_grove" ? "Entered the peaceful Dream Grove" : "Returned to the Overworld",
            goals: {...state.goals, dimensions: Math.max(state.goals.dimensions ?? 1, 2)},
        };
    }),

    resetWorld: () => {
        get().createWorld(get().seed, get().worldName, get().worldUid);
    },
}));
