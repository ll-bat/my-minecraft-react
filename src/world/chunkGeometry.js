import {BLOCK_BY_ID} from "./blocks";
import {buildChunkMeshDataCore, voxelFromIntersection} from "./chunkGeometryCore";

export {voxelFromIntersection};

export function buildChunkMeshData(
    chunks,
    key,
    selectedChunk = chunks.get(key),
    cacheRevision = 0,
    blockStates = new Map(),
    worldSeed = "minecraft-react"
) {
    return buildChunkMeshDataCore(
        chunks,
        key,
        selectedChunk,
        cacheRevision,
        blockStates,
        BLOCK_BY_ID,
        worldSeed
    );
}
