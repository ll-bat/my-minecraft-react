async function request(path, options = {}) {
    const {retries = 0, ...fetchOptions} = options;
    let response;
    let attempt = 0;
    while (true) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
            response = await fetch(path, {
                ...fetchOptions,
                signal: fetchOptions.signal ?? controller.signal,
                headers: {"Content-Type": "application/json", ...(fetchOptions.headers ?? {})},
            });
            if (response.status < 500 || attempt >= retries) break;
        } catch (error) {
            if (attempt >= retries) throw error;
        } finally {
            clearTimeout(timeout);
        }
        const retryDelay = 250 * (2 ** attempt);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        attempt += 1;
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(body.error?.message ?? `Request failed (${response.status})`);
        error.code = body.error?.code ?? "REQUEST_FAILED";
        error.status = response.status;
        error.details = body.error?.details;
        throw error;
    }
    return body;
}

export const worldApi = {
    health: () => request("/api/health"),
    list: () => request("/api/worlds"),
    create: (body) => request("/api/worlds", {method: "POST", body: JSON.stringify(body)}),
    import: (body) => request("/api/worlds/import", {method: "POST", body: JSON.stringify(body)}),
    load: (worldId) => request(`/api/worlds/${encodeURIComponent(worldId)}`),
    region: (worldId, query) => request(`/api/worlds/${encodeURIComponent(worldId)}/regions?${new URLSearchParams(query)}`),
    autosave: (worldId, body) => request(`/api/worlds/${encodeURIComponent(worldId)}/autosave`, {method: "PATCH", body: JSON.stringify(body), retries: 2}),
    savePlayer: (worldId, body, keepalive = false) => request(`/api/worlds/${encodeURIComponent(worldId)}/player`, {method: "PATCH", keepalive, body: JSON.stringify(body)}),
    reset: (worldId, body) => request(`/api/worlds/${encodeURIComponent(worldId)}/reset`, {method: "POST", body: JSON.stringify(body)}),
    delete: (worldId) => request(`/api/worlds/${encodeURIComponent(worldId)}`, {method: "DELETE"}),
    duplicate: (worldId, id) => request(`/api/worlds/${encodeURIComponent(worldId)}/duplicate`, {method: "POST", body: JSON.stringify({id})}),
    export: (worldId) => request(`/api/worlds/${encodeURIComponent(worldId)}/export`),
    listPacks: () => request("/api/data-packs"),
    savePack: (pack) => request(`/api/data-packs/${encodeURIComponent(pack.namespace)}`, {method: "PUT", body: JSON.stringify(pack)}),
};
