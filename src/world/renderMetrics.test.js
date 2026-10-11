import {
    registerChunkMetrics,
    registerModelMetrics,
    renderingMetrics,
    unregisterChunkMetrics,
    unregisterModelMetrics,
} from "./renderMetrics";

describe("rendering metrics", () => {
    test("reports worker, install, layer, model, memory, and renderer measurements", () => {
        const values = (length) => new Float32Array(length);
        registerChunkMetrics("0,0,0", {
            materials: new Map([
                ["atlas:opaque", {positions: values(90), normals: values(90), uvs: values(60), colors: values(90), tileUvs: values(60), atlasRects: values(120)}],
                ["atlas:translucent:static:glass", {positions: values(18), normals: values(18), uvs: values(12), colors: values(18), tileUvs: values(12), atlasRects: values(24)}],
            ]),
            collision: {vertices: values(54), indices: new Uint32Array(18)},
            stats: {workerMeshMs: 4},
        }, 2);
        registerModelMetrics("chair", "furniture", {attributes: {position: {count: 30}}}, 3);
        const renderer = {info: {render: {calls: 8, triangles: 42}, memory: {geometries: 4, textures: 5}}};
        const metrics = renderingMetrics(renderer, [10, 12, 14], 4);

        expect(metrics).toMatchObject({drawCalls: 8, triangles: 42, budgetDistance: 4, workerMeshMs: 4, meshInstallMs: 2});
        expect(metrics.layers).toMatchObject({opaque: 10, translucent: 2, models: 30});
        expect(metrics.objects.furniture).toBe(30);
        expect(metrics.gpuMb).toBeGreaterThan(0);
        unregisterChunkMetrics("0,0,0");
        unregisterModelMetrics("chair");
    });
});
