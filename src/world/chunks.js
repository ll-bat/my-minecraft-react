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

export function setBlocks(chunks, entries) {
    const nextChunks = new Map(chunks);
    const changedChunks = new Map();
    entries.forEach(({position, blockId}) => {
        const location = locateBlock(position);
        let chunk = changedChunks.get(location.chunkKey);
        if (!chunk) {
            chunk = new Map(nextChunks.get(location.chunkKey) ?? []);
            changedChunks.set(location.chunkKey, chunk);
        }
        if (blockId === null) chunk.delete(location.index);
        else chunk.set(location.index, blockId);
    });
    changedChunks.forEach((chunk, key) => {
        if (chunk.size) nextChunks.set(key, chunk);
        else nextChunks.delete(key);
    });
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

// Meshing needs every block in the target chunk, but only the inward-facing
// layer of each direct neighbor. Keeping the worker payload this small avoids
// cloning six complete chunks on the main thread for every mesh request.
export function meshingChunkNeighborhood(chunks, key) {
    const [chunkX, chunkY, chunkZ] = parseChunkKey(key);
    const compact = new Map();
    const selected = chunks.get(key);
    if (selected) compact.set(key, selected);

    const neighbors = [
        [chunkX + 1, chunkY, chunkZ, 0, null, null],
        [chunkX - 1, chunkY, chunkZ, CHUNK_SIZE - 1, null, null],
        [chunkX, chunkY + 1, chunkZ, null, 0, null],
        [chunkX, chunkY - 1, chunkZ, null, CHUNK_SIZE - 1, null],
        [chunkX, chunkY, chunkZ + 1, null, null, 0],
        [chunkX, chunkY, chunkZ - 1, null, null, CHUNK_SIZE - 1],
    ];

    neighbors.forEach(([x, y, z, fixedX, fixedY, fixedZ]) => {
        const neighborKey = chunkKey(x, y, z);
        const source = chunks.get(neighborKey);
        if (!source) return;
        const boundary = new Map();
        const minX = fixedX ?? 0;
        const maxX = fixedX ?? CHUNK_SIZE - 1;
        const minY = fixedY ?? 0;
        const maxY = fixedY ?? CHUNK_SIZE - 1;
        const minZ = fixedZ ?? 0;
        const maxZ = fixedZ ?? CHUNK_SIZE - 1;
        for (let localY = minY; localY <= maxY; localY += 1) {
            for (let localZ = minZ; localZ <= maxZ; localZ += 1) {
                for (let localX = minX; localX <= maxX; localX += 1) {
                    const index = localIndex(localX, localY, localZ);
                    const blockId = source.get(index);
                    if (blockId) boundary.set(index, blockId);
                }
            }
        }
        if (boundary.size) compact.set(neighborKey, boundary);
    });

    return compact;
}
