let worker = null;
let nextRequestId = 1;
const pending = new Map();
const completed = [];
let deliveryScheduled = false;

function deliverNextMesh() {
    deliveryScheduled = false;
    const result = completed.shift();
    if (result) result.resolve(result.mesh);
    if (completed.length > 0) scheduleMeshDelivery();
}

function scheduleMeshDelivery() {
    if (deliveryScheduled) return;
    deliveryScheduled = true;
    if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(deliverNextMesh);
    } else {
        setTimeout(deliverNextMesh, 0);
    }
}

function meshWorker() {
    if (worker) return worker;
    worker = new Worker(new URL("../workers/meshWorker.js", import.meta.url));
    worker.addEventListener("message", (event) => {
        const request = pending.get(event.data.id);
        if (!request) return;
        pending.delete(event.data.id);
        completed.push({resolve: request.resolve, mesh: event.data.mesh});
        scheduleMeshDelivery();
    });
    worker.addEventListener("error", (error) => {
        pending.forEach(({reject}) => reject(error));
        pending.clear();
        worker?.terminate();
        worker = null;
    });
    return worker;
}

export function buildChunkMeshInWorker(request) {
    return new Promise((resolve, reject) => {
        const id = nextRequestId;
        nextRequestId += 1;
        pending.set(id, {resolve, reject});
        meshWorker().postMessage({...request, id});
    });
}
