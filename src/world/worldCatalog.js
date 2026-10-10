export const WORLD_CATALOG_KEY = "minecraft-react-worlds";
export const ACTIVE_WORLD_KEY = "minecraft-react-active-world";
export const WORLD_DOCUMENT_PREFIX = "minecraft-react-world:";

const safeParse = (value, fallback) => {
    try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
};

export function worldDocumentKey(id) {
    return `${WORLD_DOCUMENT_PREFIX}${id}`;
}

export function readCatalog(storage = window.localStorage) {
    const value = safeParse(storage.getItem(WORLD_CATALOG_KEY), []);
    return Array.isArray(value) ? value.filter((world) => world && typeof world.id === "string" && typeof world.name === "string") : [];
}

export function writeCatalog(worlds, storage = window.localStorage) {
    storage.setItem(WORLD_CATALOG_KEY, JSON.stringify(worlds));
}

export function ensureWorldCatalog(legacyKey, storage = window.localStorage) {
    let worlds = readCatalog(storage);
    if (!worlds.length) {
        const id = "world-default";
        const now = Date.now();
        const legacy = storage.getItem(legacyKey);
        const legacyDocument = safeParse(legacy, null);
        if (legacy) storage.setItem(worldDocumentKey(id), legacy);
        worlds = [{id, name: "My World", seed: String(legacyDocument?.seed || "minecraft-react"), createdAt: now, lastPlayedAt: now}];
        writeCatalog(worlds, storage);
        storage.setItem(ACTIVE_WORLD_KEY, id);
    }
    const requested = storage.getItem(ACTIVE_WORLD_KEY);
    const active = worlds.some((world) => world.id === requested) ? requested : worlds[0].id;
    storage.setItem(ACTIVE_WORLD_KEY, active);
    return {worlds, active};
}

export function upsertWorld(meta, serialized, storage = window.localStorage) {
    const worlds = readCatalog(storage);
    const next = [...worlds.filter((world) => world.id !== meta.id), {...meta, lastPlayedAt: Date.now()}]
        .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
    writeCatalog(next, storage);
    storage.setItem(worldDocumentKey(meta.id), serialized);
    storage.setItem(ACTIVE_WORLD_KEY, meta.id);
    return next;
}

export function deleteWorldRecord(id, storage = window.localStorage) {
    const next = readCatalog(storage).filter((world) => world.id !== id);
    storage.removeItem(worldDocumentKey(id));
    writeCatalog(next, storage);
    if (storage.getItem(ACTIVE_WORLD_KEY) === id) {
        if (next[0]) storage.setItem(ACTIVE_WORLD_KEY, next[0].id);
        else storage.removeItem(ACTIVE_WORLD_KEY);
    }
    return next;
}

export function exportWorldRecord(id, storage = window.localStorage) {
    const meta = readCatalog(storage).find((world) => world.id === id);
    const document = safeParse(storage.getItem(worldDocumentKey(id)), null);
    return meta && document ? JSON.stringify({format: "minecraft-react-export", version: 1, meta, document}, null, 2) : null;
}

export function duplicateWorldRecord(id, newId, storage = window.localStorage) {
    const source = readCatalog(storage).find((world) => world.id === id);
    const document = storage.getItem(worldDocumentKey(id));
    if (!source || !document) return null;
    const copy = {...source, id: newId, name: `${source.name} (Copy)`, createdAt: Date.now(), lastPlayedAt: Date.now()};
    upsertWorld(copy, document, storage);
    return copy;
}

export function importWorldRecord(serialized, newId, storage = window.localStorage) {
    const value = safeParse(serialized, null);
    if (!value || value.format !== "minecraft-react-export" || value.version !== 1 || !value.meta || !value.document || !Array.isArray(value.document.chunks)) {
        return {ok: false, error: "Invalid Minecraft React world file"};
    }
    const id = newId;
    const meta = {...value.meta, id, name: `${value.meta.name} (Imported)`, createdAt: Date.now(), lastPlayedAt: Date.now()};
    upsertWorld(meta, JSON.stringify(value.document), storage);
    return {ok: true, meta};
}
