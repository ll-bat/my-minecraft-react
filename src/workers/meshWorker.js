/* global globalThis */
import {buildChunkMeshDataCore} from "../world/chunkGeometryCore";

let blockDefinitions = {};

globalThis.addEventListener("message", (event) => {
    const {id, chunks, chunkKey, selectedChunk, revision, blockStates, worldSeed} = event.data;
    if (event.data.blockDefinitions) blockDefinitions = event.data.blockDefinitions;
    const startedAt = performance.now();
    const mesh = buildChunkMeshDataCore(
        chunks,
        chunkKey,
        selectedChunk,
        revision,
        blockStates,
        blockDefinitions,
        worldSeed
    );
    const transfer = [];
    const materials = new Map(Array.from(mesh.materials, ([blockId, data]) => {
        const positions = new Float32Array(data.positions);
        const normals = new Float32Array(data.normals);
        const uvs = new Float32Array(data.uvs);
        const colors = new Float32Array(data.colors);
        const tileUvs = new Float32Array(data.tileUvs);
        const atlasRects = new Float32Array(data.atlasRects);
        transfer.push(positions.buffer, normals.buffer, uvs.buffer, colors.buffer, tileUvs.buffer, atlasRects.buffer);
        return [blockId, {positions, normals, uvs, colors, tileUvs, atlasRects}];
    }));
    const collision = {
        vertices: new Float32Array(mesh.collision.vertices),
        indices: new Uint32Array(mesh.collision.indices),
    };
    const stats = {workerMeshMs: performance.now() - startedAt};
    transfer.push(collision.vertices.buffer, collision.indices.buffer);
    globalThis.postMessage({id, mesh: {materials, collision, stats}}, transfer);
});
