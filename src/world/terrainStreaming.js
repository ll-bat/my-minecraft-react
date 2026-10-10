import {generateChunkColumn} from "./terrain";
import {addStructure, structureForColumn} from "./structures";
import {rebuildBlockLightCore} from "./lightingCore";

function generateSynchronously({seed, dimension, chunkX, chunkZ, lightDefinitions}) {
    const dimensionSeed = dimension === "overworld" ? seed : `${seed}:dream-grove`;
    const structure = structureForColumn(seed, chunkX, chunkZ, dimension);
    let chunks = generateChunkColumn(dimensionSeed, chunkX, chunkZ);
    chunks = addStructure(chunks, seed, structure ? {...structure, dimensionSeed} : null);
    return {
        chunks,
        structure,
        blockLight: rebuildBlockLightCore(chunks, lightDefinitions),
    };
}

export async function generateTerrainColumnAsync(request) {
    if (typeof Worker === "undefined") return generateSynchronously(request);
    try {
        const {generateTerrainColumnInWorker} = await import("./terrainWorkerClient");
        return await generateTerrainColumnInWorker(request);
    } catch {
        return generateSynchronously(request);
    }
}
