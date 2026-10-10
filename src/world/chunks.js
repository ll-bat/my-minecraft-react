export const CHUNK_SIZE = 16;

export function chunkCoordinate(worldCoordinate) {
    return Math.floor(worldCoordinate / CHUNK_SIZE);
}

export function localCoordinate(worldCoordinate) {
    return ((worldCoordinate % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
}

export function chunkKey(chunkX, chunkY, chunkZ) {
    return `${chunkX},${chunkY},${chunkZ}`;
}

export function columnKey(chunkX, chunkZ) {
    return `${chunkX},${chunkZ}`;
}

export function parseChunkKey(key) {
    return key.split(",").map(Number);
}

export function localIndex(localX, localY, localZ) {
    return localX + localZ * CHUNK_SIZE + localY * CHUNK_SIZE * CHUNK_SIZE;
}

export function indexToLocal(index) {
    const localY = Math.floor(index / (CHUNK_SIZE * CHUNK_SIZE));
    const remainder = index - localY * CHUNK_SIZE * CHUNK_SIZE;
    const localZ = Math.floor(remainder / CHUNK_SIZE);
    const localX = remainder % CHUNK_SIZE;
    return [localX, localY, localZ];
}

export function locateBlock(position) {
    const [x, y, z] = position.map(Math.round);
    const chunk = [chunkCoordinate(x), chunkCoordinate(y), chunkCoordinate(z)];
    const local = [localCoordinate(x), localCoordinate(y), localCoordinate(z)];
    return {
        chunk,
        chunkKey: chunkKey(...chunk),
        index: localIndex(...local),
        local,
        position: [x, y, z],
    };
}

export function worldPosition(chunk, local) {
    return [
        chunk[0] * CHUNK_SIZE + local[0],
        chunk[1] * CHUNK_SIZE + local[1],
        chunk[2] * CHUNK_SIZE + local[2],
    ];
}

export function getBlock(chunks, position) {
    const location = locateBlock(position);
    return chunks.get(location.chunkKey)?.get(location.index) ?? null;
}

export function setBlock(chunks, position, blockId) {
    const location = locateBlock(position);
    const nextChunks = new Map(chunks);
    const nextChunk = new Map(nextChunks.get(location.chunkKey) ?? []);

    if (blockId === null) {
        nextChunk.delete(location.index);
    } else {
        nextChunk.set(location.index, blockId);
    }

    if (nextChunk.size === 0) {
        nextChunks.delete(location.chunkKey);
    } else {
        nextChunks.set(location.chunkKey, nextChunk);
    }

    return nextChunks;
}

export function affectedChunkKeys(position) {
    const {chunk, chunkKey: ownKey, local} = locateBlock(position);
    const keys = new Set([ownKey]);

    for (let axis = 0; axis < 3; axis += 1) {
        if (local[axis] === 0) {
            const neighbor = [...chunk];
            neighbor[axis] -= 1;
            keys.add(chunkKey(...neighbor));
        }
        if (local[axis] === CHUNK_SIZE - 1) {
            const neighbor = [...chunk];
            neighbor[axis] += 1;
            keys.add(chunkKey(...neighbor));
        }
    }

    return Array.from(keys);
}

export function neighboringChunkKeys(key) {
    const [chunkX, chunkY, chunkZ] = parseChunkKey(key);
    return [
        key,
        chunkKey(chunkX + 1, chunkY, chunkZ),
        chunkKey(chunkX - 1, chunkY, chunkZ),
        chunkKey(chunkX, chunkY + 1, chunkZ),
        chunkKey(chunkX, chunkY - 1, chunkZ),
        chunkKey(chunkX, chunkY, chunkZ + 1),
        chunkKey(chunkX, chunkY, chunkZ - 1),
    ];
}
