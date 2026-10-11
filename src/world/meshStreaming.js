import {buildChunkMeshDataCore} from "./chunkGeometryCore";

function buildTimed(request) {
    const startedAt = performance.now();
    const mesh = buildChunkMeshDataCore(
        request.chunks,
        request.chunkKey,
        request.selectedChunk,
        request.revision,
        request.blockStates,
        request.blockDefinitions,
        request.worldSeed
    );
    mesh.stats = {workerMeshMs: performance.now() - startedAt};
    return mesh;
}

export async function buildChunkMeshAsync(request) {
    if (typeof Worker === "undefined") {
        return buildTimed(request);
    }
    try {
        const {buildChunkMeshInWorker} = await import("./meshWorkerClient");
        return await buildChunkMeshInWorker(request);
    } catch {
        return buildTimed(request);
    }
}
