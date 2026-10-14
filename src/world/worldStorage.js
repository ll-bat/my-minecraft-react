import {BLOCK_BY_ID, isBlockId} from "./blocks";
import {columnKey, locateBlock} from "./chunks";
import {seedToNumber} from "./noise";
import {creativeInventory, emptyInventory, normalizeInventory, validStack} from "./inventory";
import {isItemId} from "./items";
import {createFurnace} from "./furnaces";
import {validCreature} from "./entities";
import {createChest} from "./interactions";
import {ACTIVE_WORLD_KEY, readCatalog, upsertWorld, worldDocumentKey} from "./worldCatalog";
import {normalizeWeather} from "./sky";

export const WORLD_STORAGE_KEY = "minecraft-react-world";
export const LEGACY_STORAGE_KEY = "cubes";
export const WORLD_VERSION = 9;
export const DEFAULT_WORLD_SEED = "minecraft-react";

function validPosition(value) {
    return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}

function validKey(value, parts) {
    if (typeof value !== "string") {
        return false;
    }
    const coordinates = value.split(",");
    return coordinates.length === parts
        && coordinates.every((coordinate) => /^-?\d+$/.test(coordinate));
}

function normalizeSlots(value, size) {
    const slots = Array(size).fill(null);
    if (!Array.isArray(value)) return slots;
    value.slice(0, size).forEach((stack, index) => {
        if (stack !== null && validStack(stack)) slots[index] = {...stack};
    });
    return slots;
}

function normalizeFurnace(value) {
    if (!value || typeof value !== "object") return null;
    const slots = [value.input, value.fuel, value.output].map((stack) => (
        stack !== null && validStack(stack) ? {...stack} : null
    ));
    return {
        ...createFurnace(Number.isFinite(value.lastUpdated) ? value.lastUpdated : Date.now()),
        input: slots[0], fuel: slots[1], output: slots[2],
        burnRemaining: Number.isFinite(value.burnRemaining) ? Math.max(0, value.burnRemaining) : 0,
        cookProgress: Number.isFinite(value.cookProgress) ? Math.max(0, value.cookProgress) : 0,
    };
}

function normalizeBlockEntity(value) {
    if (value?.type === "chest") {
        return {
            ...createChest(),
            slots: normalizeSlots(value.slots, 27),
            revision: Number.isInteger(value.revision) ? Math.max(0, value.revision) : 0,
        };
    }
    return normalizeFurnace(value);
}

export function serializeChunks(chunks) {
    return Array.from(chunks ?? [], ([key, chunk]) => {
        const palette = [];
        const paletteIndexes = new Map();
        const entries = Array.from(chunk).sort(([left], [right]) => left - right);
        const runs = [];
        let runStart = -1;
        let runLength = 0;
        let runPalette = -1;

        const finishRun = () => {
            if (runLength > 0) runs.push(runStart, runLength, runPalette);
        };

        entries.forEach(([index, blockId]) => {
            let paletteIndex = paletteIndexes.get(blockId);
            if (paletteIndex === undefined) {
                paletteIndex = palette.length;
                paletteIndexes.set(blockId, paletteIndex);
                palette.push(blockId);
            }
            if (index === runStart + runLength && paletteIndex === runPalette) {
                runLength += 1;
            } else {
                finishRun();
                runStart = index;
                runLength = 1;
                runPalette = paletteIndex;
            }
        });
        finishRun();
        return [key, palette, runs];
    });
}

export function normalizeChunks(value) {
    const chunks = new Map();
    if (!Array.isArray(value)) return chunks;
    value.forEach((record) => {
        if (!Array.isArray(record) || !validKey(record[0], 3)) return;
        const key = record[0];
        const chunk = new Map();
        if (record.length === 2 && Array.isArray(record[1])) {
            record[1].forEach(([index, blockId]) => {
                if (Number.isInteger(index) && index >= 0 && index < 4096 && isBlockId(blockId)) {
                    chunk.set(index, blockId);
                }
            });
        } else if (record.length === 3 && Array.isArray(record[1]) && Array.isArray(record[2])) {
            const [palette, runs] = [record[1], record[2]];
            for (let offset = 0; offset + 2 < runs.length; offset += 3) {
                const start = runs[offset];
                const length = runs[offset + 1];
                const paletteIndex = runs[offset + 2];
                const blockId = palette[paletteIndex];
                if (!Number.isInteger(start) || !Number.isInteger(length) || length <= 0
                    || start < 0 || start + length > 4096 || !isBlockId(blockId)) continue;
                for (let index = start; index < start + length; index += 1) chunk.set(index, blockId);
            }
        }
        // Empty snapshots are authoritative and prevent removed generated
        // terrain from returning after the world is loaded again.
        chunks.set(key, chunk);
    });
    return chunks;
}

function serializeSnapshot(value) {
    return {
        ...value,
        chunks: serializeChunks(value.chunks),
        generatedColumns: Array.from(value.generatedColumns ?? []),
        fluidLevels: Array.from(value.fluidLevels ?? []),
        blockEntities: Array.from(value.blockEntities ?? []),
        blockStates: Array.from(value.blockStates ?? []),
        spawnedCreatureGroups: Array.from(value.spawnedCreatureGroups ?? []),
    };
}

function normalizeSnapshot(value) {
    if (!value || !Array.isArray(value.chunks)) return null;
    return {
        ...value,
        chunks: normalizeChunks(value.chunks),
        generatedColumns: new Set(value.generatedColumns ?? []),
        fluidLevels: new Map(value.fluidLevels ?? []),
        blockEntities: new Map((value.blockEntities ?? []).map(([key, entity]) => [key, normalizeBlockEntity(entity)]).filter(([, entity]) => entity)),
        blockStates: new Map(value.blockStates ?? []),
        spawnedCreatureGroups: new Set(value.spawnedCreatureGroups ?? []),
        scheduledUpdates: Array.isArray(value.scheduledUpdates) ? value.scheduledUpdates : [],
        entities: Array.isArray(value.entities) ? value.entities.filter(validCreature) : [],
        playerPosition: validPosition(value.playerPosition) ? value.playerPosition : null,
    };
}

function legacyWorld(cubes) {
    const chunks = new Map();
    cubes.forEach((cube) => {
        if (!cube || !validPosition(cube.pos) || !isBlockId(cube.texture)) {
            return;
        }
        const location = locateBlock(cube.pos);
        const chunk = chunks.get(location.chunkKey) ?? new Map();
        chunk.set(location.index, cube.texture);
        chunks.set(location.chunkKey, chunk);
    });

    return {
        version: WORLD_VERSION,
        seed: DEFAULT_WORLD_SEED,
        texture: "dirt",
        playerPosition: null,
        generatedColumns: new Set(),
        fluidLevels: new Map(),
        inventory: creativeInventory(),
        survivalInventory: emptyInventory(),
        selectedHotbar: 0,
        gameMode: "creative",
        drops: [],
        playerCrafting: Array(4).fill(null),
        tableCrafting: Array(9).fill(null),
        blockEntities: new Map(),
        blockStates: new Map(),
        scheduledUpdates: [],
        worldTime: 0,
        skyWeather: "sunny",
        entities: [],
        spawnedCreatureGroups: new Set(),
        chunks,
    };
}

export function parseWorldDocument(serialized, legacySerialized = null) {
    try {
        if (serialized === null) {
            if (legacySerialized === null) {
                return null;
            }
            const legacy = JSON.parse(legacySerialized);
            return Array.isArray(legacy) ? legacyWorld(legacy) : null;
        }

        const document = JSON.parse(serialized);
        if (!Number.isInteger(document.version)
            || document.version < 2
            || document.version > WORLD_VERSION
            || !Array.isArray(document.chunks)) {
            return null;
        }

        const migrated = document.version === 2;

        const chunks = normalizeChunks(document.chunks);

        return {
            version: WORLD_VERSION,
            seed: String(document.seed || DEFAULT_WORLD_SEED),
            texture: isBlockId(document.texture) && BLOCK_BY_ID[document.texture].placeable
                ? document.texture
                : "dirt",
            playerPosition: validPosition(document.playerPosition) ? document.playerPosition : null,
            generatedColumns: new Set(
                Array.isArray(document.generatedColumns)
                    ? document.generatedColumns.filter((key) => validKey(key, 2))
                    : []
            ),
            fluidLevels: new Map(
                Array.isArray(document.fluidLevels)
                    ? document.fluidLevels.filter(([key, level]) => (
                        validKey(key, 3) && Number.isInteger(level) && level >= 0 && level <= 6
                    ))
                    : []
            ),
            inventory: migrated ? creativeInventory() : normalizeInventory(document.inventory),
            survivalInventory: migrated ? emptyInventory() : normalizeInventory(document.survivalInventory),
            selectedHotbar: Number.isInteger(document.selectedHotbar)
                && document.selectedHotbar >= 0 && document.selectedHotbar < 9
                ? document.selectedHotbar
                : 0,
            gameMode: migrated || document.gameMode === "creative" ? "creative" : "survival",
            renderDistance: document.version >= 8 && Number.isInteger(document.renderDistance)
                ? Math.max(1, Math.min(9, document.renderDistance))
                : 4,
            drops: migrated || !Array.isArray(document.drops) ? [] : document.drops.filter((drop) => (
                drop
                && typeof drop.id === "string"
                && isItemId(drop.itemId)
                && Number.isInteger(drop.count)
                && drop.count > 0
                && validPosition(drop.position)
                && Number.isFinite(drop.createdAt)
            )).map((drop) => ({...drop, position: [...drop.position]})),
            playerCrafting: normalizeSlots(document.playerCrafting, 4),
            tableCrafting: normalizeSlots(document.tableCrafting, 9),
            blockEntities: new Map(
                Array.isArray(document.blockEntities)
                    ? document.blockEntities.map(([key, value]) => [key, normalizeBlockEntity(value)])
                        .filter(([key, value]) => validKey(key, 3) && value)
                    : []
            ),
            blockStates: new Map(
                Array.isArray(document.blockStates)
                    ? document.blockStates.filter(([key, value]) => validKey(key, 3) && value && typeof value === "object")
                        .map(([key, value]) => [key, {
                            facing: ["north", "south", "east", "west"].includes(value.facing) ? value.facing : "north",
                            half: value.half === "upper" ? "upper" : "lower",
                            open: Boolean(value.open),
                            powered: Boolean(value.powered),
                        }])
                    : []
            ),
            scheduledUpdates: Array.isArray(document.scheduledUpdates)
                ? document.scheduledUpdates.filter((update) => update && update.type === "crop" && validPosition(update.position) && Number.isFinite(update.due))
                    .map((update) => ({...update, position: [...update.position]}))
                : [],
            worldTime: Number.isFinite(document.worldTime) ? Math.max(0, document.worldTime) : 0,
            skyWeather: normalizeWeather(document.skyWeather),
            dimension: document.dimension === "dream_grove" ? "dream_grove" : "overworld",
            dimensionSnapshots: new Map(Array.isArray(document.dimensionSnapshots)
                ? document.dimensionSnapshots.map(([id, value]) => [id, normalizeSnapshot(value)]).filter(([, value]) => value)
                : []),
            exploredColumns: new Set(Array.isArray(document.exploredColumns) ? document.exploredColumns.filter((key) => typeof key === "string") : []),
            discoveredBiomes: new Set(Array.isArray(document.discoveredBiomes) ? document.discoveredBiomes.filter((value) => typeof value === "string") : []),
            markers: Array.isArray(document.markers) ? document.markers.filter((marker) => marker && typeof marker.id === "string" && typeof marker.name === "string" && validPosition(marker.position)) : [],
            discoveredStructures: Array.isArray(document.discoveredStructures) ? document.discoveredStructures.filter((entry) => entry && typeof entry.id === "string") : [],
            goals: document.goals && typeof document.goals === "object" ? document.goals : {},
            gameRules: document.gameRules && typeof document.gameRules === "object" ? document.gameRules : {dayCycle: true, weather: true, creatures: true, cropGrowth: true},
            enabledPacks: Array.isArray(document.enabledPacks) ? document.enabledPacks.filter((id) => typeof id === "string") : [],
            entities: Array.isArray(document.entities)
                ? document.entities.filter(validCreature).map((entity) => ({
                    ...entity,
                    position: [...entity.position],
                    velocity: Array.isArray(entity.velocity) && entity.velocity.length === 3
                        ? entity.velocity.map((value) => Number.isFinite(value) ? value : 0)
                        : [0, 0, 0],
                    friendLevel: Number.isInteger(entity.friendLevel) ? Math.max(0, Math.min(5, entity.friendLevel)) : 0,
                    followUntil: Number.isFinite(entity.followUntil) ? entity.followUntil : 0,
                    lastInteraction: Number.isFinite(entity.lastInteraction) ? entity.lastInteraction : 0,
                    lastGift: Number.isFinite(entity.lastGift) ? entity.lastGift : 0,
                    persistent: Boolean(entity.persistent),
                }))
                : [],
            spawnedCreatureGroups: new Set(
                Array.isArray(document.spawnedCreatureGroups)
                    ? document.spawnedCreatureGroups.filter((key) => typeof key === "string")
                    : []
            ),
            chunks,
        };
    } catch (error) {
        return null;
    }
}

export function serializeWorld(state) {
    return JSON.stringify({
        version: WORLD_VERSION,
        seed: state.seed,
        seedNumber: seedToNumber(state.seed),
        texture: state.texture,
        playerPosition: state.playerPosition,
        generatedColumns: Array.from(state.generatedColumns),
        fluidLevels: Array.from(state.fluidLevels ?? []),
        inventory: state.inventory,
        survivalInventory: state.survivalInventory,
        selectedHotbar: state.selectedHotbar,
        gameMode: state.gameMode,
        renderDistance: state.renderDistance ?? 4,
        drops: state.drops,
        playerCrafting: state.playerCrafting,
        tableCrafting: state.tableCrafting,
        blockEntities: Array.from(state.blockEntities ?? []),
        blockStates: Array.from(state.blockStates ?? []),
        scheduledUpdates: state.scheduledUpdates ?? [],
        worldTime: state.worldTime ?? 0,
        skyWeather: normalizeWeather(state.skyWeather),
        dimension: state.dimension ?? "overworld",
        dimensionSnapshots: Array.from(state.dimensionSnapshots ?? [], ([id, value]) => [id, serializeSnapshot(value)]),
        exploredColumns: Array.from(state.exploredColumns ?? []),
        discoveredBiomes: Array.from(state.discoveredBiomes ?? []),
        markers: state.markers ?? [],
        discoveredStructures: state.discoveredStructures ?? [],
        goals: state.goals ?? {},
        gameRules: state.gameRules ?? {},
        enabledPacks: state.enabledPacks ?? [],
        entities: state.entities ?? [],
        spawnedCreatureGroups: Array.from(state.spawnedCreatureGroups ?? []),
        chunks: serializeChunks(state.chunks),
    });
}

export function readWorld() {
    if (typeof window === "undefined") {
        return null;
    }
    const worlds = readCatalog();
    const requested = window.localStorage.getItem(ACTIVE_WORLD_KEY);
    const active = worlds.some((world) => world.id === requested) ? requested : worlds[0]?.id;
    const legacyDocument = window.localStorage.getItem(WORLD_STORAGE_KEY);
    const legacyCubes = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!active && legacyDocument === null && legacyCubes === null) return null;
    const parsed = parseWorldDocument(
        active ? window.localStorage.getItem(worldDocumentKey(active)) ?? legacyDocument : legacyDocument,
        legacyCubes
    );
    return parsed ? {...parsed, worldMeta: worlds.find((world) => world.id === active) ?? {id: "world-default", name: "My World", seed: parsed.seed, createdAt: Date.now()}} : null;
}

export function writeWorld(state) {
    const serialized = serializeWorld(state);
    // The per-world document is authoritative. Removing the old single-world
    // mirror avoids storing the same potentially large document twice.
    window.localStorage.removeItem(WORLD_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    upsertWorld({id: state.worldUid ?? "world-default", name: state.worldName ?? "My World", seed: state.seed, createdAt: state.worldCreatedAt ?? Date.now()}, serialized);
}

export function worldCatalog() {
    return typeof window === "undefined" ? [] : readCatalog();
}

export function selectWorld(id) {
    if (typeof window !== "undefined") window.localStorage.setItem(ACTIVE_WORLD_KEY, id);
}

export function clearSavedWorld(worldId = null) {
    window.localStorage.removeItem(WORLD_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    if (worldId) window.localStorage.removeItem(worldDocumentKey(worldId));
}

export function generatedColumnForPosition(position) {
    const {chunk} = locateBlock(position);
    return columnKey(chunk[0], chunk[2]);
}
