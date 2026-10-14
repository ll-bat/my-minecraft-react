import {chunkKey, locateBlock, parseChunkKey} from "./chunks";
import {normalizeChunks, parseWorldDocument, serializeChunks, serializeWorld} from "./worldStorage";

const splitDimensionKey = (value) => {
    const separator = value.indexOf("|");
    return [value.slice(0, separator), value.slice(separator + 1)];
};

export const persistenceChunkKey = (dimension, key) => `${dimension}|${key}`;

export function markDirtyPositions(dirtyChunks, dimension, positions) {
    const next = new Map(dirtyChunks);
    positions.forEach((position) => {
        const key = persistenceChunkKey(dimension, locateBlock(position).chunkKey);
        next.set(key, (next.get(key) ?? 0) + 1);
    });
    return next;
}

function sanitizedSnapshot(value) {
    if (!value) return null;
    return {
        ...value,
        chunks: [], generatedColumns: [], fluidLevels: [], blockEntities: [], blockStates: [],
        scheduledUpdates: [], entities: [], spawnedCreatureGroups: [],
    };
}

export function remoteDocument(state) {
    // Avoid serializing the potentially huge rendered world just to discard
    // it. Chunk and entity records travel in their own bounded payloads.
    const emptySnapshot = (value) => ({
        ...value, chunks: new Map(), generatedColumns: new Set(), fluidLevels: new Map(),
        blockEntities: new Map(), blockStates: new Map(), scheduledUpdates: [],
        entities: [], spawnedCreatureGroups: new Set(),
    });
    return JSON.parse(serializeWorld({
        ...emptySnapshot(state),
        dimensionSnapshots: new Map(Array.from(state.dimensionSnapshots ?? [], ([id, value]) => [id, emptySnapshot(value)])),
    }));
}

function sourceForDimension(state, dimension) {
    if (dimension === state.dimension) return state;
    return state.dimensionSnapshots.get(dimension) ?? null;
}

const entriesForChunk = (map, expectedKey) => Array.from(map ?? []).filter(([position]) => locateBlock(position.split(",").map(Number)).chunkKey === expectedKey);
const updatesForChunk = (updates, expectedKey) => (updates ?? []).filter((update) => locateBlock(update.position).chunkKey === expectedKey);

export function chunkPayload(state, persistentKey) {
    const [dimension, key] = splitDimensionKey(persistentKey);
    const source = sourceForDimension(state, dimension);
    if (!source) return null;
    const [chunkX, chunkY, chunkZ] = parseChunkKey(key);
    const chunk = source.chunks.get(key) ?? new Map();
    const snapshot = serializeChunks(new Map([[key, chunk]]))[0] ?? [key, [], []];
    return {
        dimension, chunkX, chunkY, chunkZ,
        revision: state.dirtyChunks.get(persistentKey) ?? 0,
        data: {
            snapshot,
            fluidLevels: entriesForChunk(source.fluidLevels, key),
            blockEntities: entriesForChunk(source.blockEntities, key),
            blockStates: entriesForChunk(source.blockStates, key),
            scheduledUpdates: updatesForChunk(source.scheduledUpdates, key),
        },
    };
}

export function allPersistentChunkKeys(state) {
    const keys = new Set(Array.from(state.chunks.keys(), (key) => persistenceChunkKey(state.dimension, key)));
    state.dimensionSnapshots.forEach((snapshot, dimension) => {
        snapshot.chunks.forEach((_chunk, key) => keys.add(persistenceChunkKey(dimension, key)));
    });
    return keys;
}

export function buildAutosavePayload(state, batchId, positionVersion) {
    const document = remoteDocument(state);
    const chunks = Array.from(state.dirtyChunks.keys(), (key) => chunkPayload(state, key)).filter(Boolean);
    const dimensions = [[state.dimension, state], ...Array.from(state.dimensionSnapshots)]
        .map(([dimension, value]) => ({dimension, state: sanitizedSnapshot({worldTime: value.worldTime, playerPosition: value.playerPosition})}));
    const entities = [];
    [[state.dimension, state.entities], ...Array.from(state.dimensionSnapshots, ([dimension, value]) => [dimension, value.entities ?? []])]
        .forEach(([dimension, values]) => values.filter((entity) => entity.persistent || entity.id.includes(":placed:") || entity.friendLevel > 0).forEach((entity) => {
            entities.push({entityId: entity.id, dimension, chunkX: entity.chunk?.[0] ?? Math.floor(entity.position[0] / 16), chunkZ: entity.chunk?.[1] ?? Math.floor(entity.position[2] / 16), generated: !entity.id.includes(":placed:"), deleted: false, state: entity});
        }));
    (state.entityTombstones ?? new Map()).forEach((entity) => entities.push(entity));
    return {
        incarnationId: state.persistenceIncarnationId,
        batchId,
        expectedRevision: state.persistenceRevision,
        settings: {document},
        player: {position: state.playerPosition, positionVersion, state: {mountedEntityId: state.mountedEntityId}},
        dimensions,
        chunks,
        entities,
        exploredColumns: Array.from(state.exploredColumns, (value) => {
            const separator = value.indexOf(":");
            const dimension = value.slice(0, separator);
            const [chunkX, chunkZ] = value.slice(separator + 1).split(",").map(Number);
            return {dimension, chunkX, chunkZ};
        }),
        discoveredBiomes: Array.from(state.discoveredBiomes, (value) => {
            const separator = value.indexOf(":");
            return {dimension: value.slice(0, separator), biomeId: value.slice(separator + 1)};
        }),
        discoveredStructures: state.discoveredStructures.map((value) => ({structureId: value.id, dimension: value.id.split(":")[0] || state.dimension, data: value})),
        markers: state.markers,
        deletedMarkerIds: [],
    };
}

export function applyRemoteChunks(state, dimension, records, entityRecords = []) {
    let chunks = state.chunks;
    const fluidLevels = new Map(state.fluidLevels);
    const blockEntities = new Map(state.blockEntities);
    const blockStates = new Map(state.blockStates);
    let scheduledUpdates = state.scheduledUpdates;
    const remoteAuthoritativeChunks = new Set(state.remoteAuthoritativeChunks ?? []);
    records.forEach((record) => {
        const key = chunkKey(record.chunkX, record.chunkY, record.chunkZ);
        remoteAuthoritativeChunks.add(persistenceChunkKey(dimension, key));
        const decoded = normalizeChunks([record.data.snapshot]);
        chunks = new Map(chunks);
        chunks.set(key, decoded.get(key) ?? new Map());
        (record.data.fluidLevels ?? []).forEach(([position, value]) => fluidLevels.set(position, value));
        (record.data.blockEntities ?? []).forEach(([position, value]) => blockEntities.set(position, value));
        (record.data.blockStates ?? []).forEach(([position, value]) => blockStates.set(position, value));
        scheduledUpdates = [...scheduledUpdates.filter((update) => locateBlock(update.position).chunkKey !== key), ...(record.data.scheduledUpdates ?? [])];
    });
    const deleted = new Set(entityRecords.filter((record) => record.deleted).map((record) => record.entityId));
    const remoteEntities = entityRecords.filter((record) => !record.deleted && record.state).map((record) => record.state);
    const remoteIds = new Set(remoteEntities.map((entity) => entity.id));
    const deletedEntityIds = new Set(state.deletedEntityIds ?? []);
    deleted.forEach((id) => deletedEntityIds.add(id));
    remoteIds.forEach((id) => deletedEntityIds.delete(id));
    const seen = new Set();
    const entities = [...state.entities.filter((entity) => !deleted.has(entity.id) && !remoteIds.has(entity.id)), ...remoteEntities]
        .filter((entity) => {
            if (!entity?.id || seen.has(entity.id)) return false;
            seen.add(entity.id);
            return true;
        });
    return {chunks, fluidLevels, blockEntities, blockStates, scheduledUpdates, entities, deletedEntityIds, remoteAuthoritativeChunks};
}

export function documentFromBootstrap(payload) {
    const document = payload.world.settings?.document;
    if (!document) return null;
    return parseWorldDocument(JSON.stringify({...document, playerPosition: payload.player?.position ?? document.playerPosition, chunks: []}));
}
