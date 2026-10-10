import {buildChunkMeshDataCore} from "./chunkGeometryCore";

export async function buildChunkMeshAsync(request) {
    if (typeof Worker === "undefined") {
        return buildChunkMeshDataCore(
            request.chunks,
            request.chunkKey,
            request.selectedChunk,
            request.revision,
            request.blockStates,
            request.blockDefinitions
        );
    }
    try {
        const {buildChunkMeshInWorker} = await import("./meshWorkerClient");
        return await buildChunkMeshInWorker(request);
    } catch {
        return buildChunkMeshDataCore(
            request.chunks,
            request.chunkKey,
            request.selectedChunk,
            request.revision,
            request.blockStates,
            request.blockDefinitions
        );
    }
}
