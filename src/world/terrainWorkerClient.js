let worker = null;
let nextRequestId = 1;
const pending = new Map();

function terrainWorker() {
    if (worker) return worker;
    worker = new Worker(new URL("../workers/terrainWorker.js", import.meta.url));
    worker.addEventListener("message", (event) => {
        const request = pending.get(event.data.id);
        if (!request) return;
        pending.delete(event.data.id);
        request.resolve({
            chunks: event.data.chunks,
            structure: event.data.structure,
            blockLight: event.data.blockLight,
        });
    });
    worker.addEventListener("error", (error) => {
        pending.forEach(({reject}) => reject(error));
        pending.clear();
        worker?.terminate();
        worker = null;
    });
    return worker;
}

export function generateTerrainColumnInWorker(request) {
    return new Promise((resolve, reject) => {
        const id = nextRequestId;
        nextRequestId += 1;
        pending.set(id, {resolve, reject});
        terrainWorker().postMessage({...request, id});
    });
}
