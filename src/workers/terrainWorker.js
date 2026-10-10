/* global globalThis */
import {generateChunkColumn} from "../world/terrain";
import {addStructure, structureForColumn} from "../world/structures";
import {rebuildBlockLightCore} from "../world/lightingCore";

globalThis.addEventListener("message", (event) => {
    const {id, seed, dimension, chunkX, chunkZ, lightDefinitions} = event.data;
    const dimensionSeed = dimension === "overworld" ? seed : `${seed}:dream-grove`;
    const structure = structureForColumn(seed, chunkX, chunkZ, dimension);
    let chunks = generateChunkColumn(dimensionSeed, chunkX, chunkZ);
    chunks = addStructure(chunks, seed, structure ? {...structure, dimensionSeed} : null);
    const blockLight = rebuildBlockLightCore(chunks, lightDefinitions);
    globalThis.postMessage({id, chunks, structure, blockLight});
});
