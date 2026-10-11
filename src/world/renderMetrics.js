const activeChunks = new Map();
const activeModelBatches = new Map();
const workerSamples = [];
const installSamples = [];
const distanceProfiles = {};
const MAX_SAMPLES = 120;

export const PERFORMANCE_BUDGETS = {
    2: {frameMs: 20, drawCalls: 180, triangles: 800000, gpuMb: 192, workerMeshMs: 35, meshInstallMs: 7},
    4: {frameMs: 24, drawCalls: 360, triangles: 1800000, gpuMb: 320, workerMeshMs: 50, meshInstallMs: 10},
};

export const RENDER_LAYER_TRIANGLE_BUDGETS = {
    opaque: 1200000,
    cutout: 300000,
    translucent: 200000,
    emissive: 100000,
    models: 250000,
};

export const OBJECT_TRIANGLE_BUDGETS = {furniture: 100000, decor: 90000, outdoor: 60000};

function pushSample(samples, value) {
    if (!Number.isFinite(value)) return;
    samples.push(value);
    if (samples.length > MAX_SAMPLES) samples.shift();
}

function percentile(samples, ratio = 0.95) {
    if (!samples.length) return 0;
    const sorted = [...samples].sort((left, right) => left - right);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

function layerFromMaterial(materialKey) {
    return materialKey.startsWith("atlas:") ? materialKey.split(":")[1] : "opaque";
}

export function registerChunkMetrics(chunkKey, mesh, installMs) {
    const layers = {};
    const byteSize = (values) => values ? (values.byteLength ?? values.length * 4) : 0;
    let bytes = byteSize(mesh.collision.vertices) + byteSize(mesh.collision.indices);
    mesh.materials.forEach((data, materialKey) => {
        const triangles = data.positions.length / 9;
        const layer = layerFromMaterial(materialKey);
        layers[layer] = (layers[layer] ?? 0) + triangles;
        bytes += [data.positions, data.normals, data.uvs, data.colors, data.tileUvs, data.atlasRects]
            .reduce((total, values) => total + byteSize(values), 0);
    });
    activeChunks.set(chunkKey, {layers, bytes});
    pushSample(workerSamples, mesh.stats?.workerMeshMs);
    pushSample(installSamples, installMs);
}

export function unregisterChunkMetrics(chunkKey) {
    activeChunks.delete(chunkKey);
}

export function registerModelMetrics(blockId, category, geometry, instanceCount) {
    const sourceTriangles = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
    activeModelBatches.set(blockId, {category: category ?? "decor", triangles: sourceTriangles * instanceCount});
}

export function unregisterModelMetrics(blockId) {
    activeModelBatches.delete(blockId);
}

export function renderingMetrics(renderer, frameSamples, renderDistance) {
    const layers = {opaque: 0, cutout: 0, translucent: 0, emissive: 0, models: 0};
    const objects = {furniture: 0, decor: 0, outdoor: 0};
    let bufferBytes = 0;
    activeChunks.forEach((chunk) => {
        bufferBytes += chunk.bytes;
        Object.entries(chunk.layers).forEach(([layer, triangles]) => { layers[layer] = (layers[layer] ?? 0) + triangles; });
    });
    activeModelBatches.forEach((batch) => {
        layers.models += batch.triangles;
        objects[batch.category] = (objects[batch.category] ?? 0) + batch.triangles;
    });
    const frameMs = frameSamples.length ? frameSamples.reduce((sum, value) => sum + value, 0) / frameSamples.length : 0;
    const targetDistance = renderDistance >= 3 ? 4 : 2;
    const target = PERFORMANCE_BUDGETS[targetDistance];
    const gpuMb = bufferBytes / (1024 * 1024);
    const values = {
        frameMs,
        frameP95Ms: percentile(frameSamples),
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        gpuMb,
        workerMeshMs: percentile(workerSamples),
        meshInstallMs: percentile(installSamples),
        layers,
        objects,
    };
    const result = {
        ...values,
        budgetDistance: targetDistance,
        withinBudget: Object.fromEntries(Object.keys(target).map((key) => [key, values[key] <= target[key]])),
        layersWithinBudget: Object.fromEntries(Object.entries(RENDER_LAYER_TRIANGLE_BUDGETS)
            .map(([layer, budget]) => [layer, (layers[layer] ?? 0) <= budget])),
        objectsWithinBudget: Object.fromEntries(Object.entries(OBJECT_TRIANGLE_BUDGETS)
            .map(([category, budget]) => [category, (objects[category] ?? 0) <= budget])),
    };
    if (renderDistance === 2 || renderDistance === 4) {
        distanceProfiles[renderDistance] = {
            frameMs: result.frameMs,
            frameP95Ms: result.frameP95Ms,
            drawCalls: result.drawCalls,
            triangles: result.triangles,
            gpuMb: result.gpuMb,
            workerMeshMs: result.workerMeshMs,
            meshInstallMs: result.meshInstallMs,
        };
    }
    return {...result, distanceProfiles: {...distanceProfiles}};
}
