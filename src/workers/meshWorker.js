/* global globalThis */
import {buildChunkMeshDataCore} from "../world/chunkGeometryCore";

globalThis.addEventListener("message", (event) => {
    const {id, chunks, chunkKey, selectedChunk, revision, blockStates, blockDefinitions} = event.data;
    const mesh = buildChunkMeshDataCore(
        chunks,
        chunkKey,
        selectedChunk,
        revision,
        blockStates,
        blockDefinitions
    );
    const transfer = [];
    const materials = new Map(Array.from(mesh.materials, ([blockId, data]) => {
        const positions = new Float32Array(data.positions);
        const normals = new Float32Array(data.normals);
        const uvs = new Float32Array(data.uvs);
        transfer.push(positions.buffer, normals.buffer, uvs.buffer);
        return [blockId, {positions, normals, uvs}];
    }));
    const collision = {
        vertices: new Float32Array(mesh.collision.vertices),
        indices: new Uint32Array(mesh.collision.indices),
    };
    transfer.push(collision.vertices.buffer, collision.indices.buffer);
    globalThis.postMessage({id, mesh: {materials, collision}}, transfer);
});
