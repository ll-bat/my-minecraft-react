import {worldApi} from "../api/worldApi";
import {useStore} from "../hooks/useStore";
import {registerDataPack, savedDataPacks, DATA_PACKS_KEY} from "./dataPacks";
import {ACTIVE_WORLD_KEY, readCatalog, WORLD_CATALOG_KEY, WORLD_DOCUMENT_PREFIX, worldDocumentKey} from "./worldCatalog";
import {DEFAULT_WORLD_SEED, LEGACY_STORAGE_KEY, serializeWorld, WORLD_STORAGE_KEY} from "./worldStorage";
import {remoteDocument} from "./remoteWorld";

let startupPromise = null;

function clearLegacyStorage() {
    const keys = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (key?.startsWith(WORLD_DOCUMENT_PREFIX)) keys.push(key);
    }
    [...keys, WORLD_STORAGE_KEY, LEGACY_STORAGE_KEY, WORLD_CATALOG_KEY, ACTIVE_WORLD_KEY, DATA_PACKS_KEY]
        .forEach((key) => window.localStorage.removeItem(key));
}

async function migrateLegacyWorlds(existingIds) {
    const catalog = readCatalog();
    let migrated = false;
    let invalid = false;
    const activeId = window.localStorage.getItem(ACTIVE_WORLD_KEY);
    for (const meta of catalog) {
        const serialized = window.localStorage.getItem(worldDocumentKey(meta.id));
        if (!serialized) continue;
        let document;
        try { document = JSON.parse(serialized); } catch { invalid = true; continue; }
        if (existingIds.has(meta.id)) continue;
        await worldApi.import({
            format: "minecraft-react-export",
            version: 1,
            newId: meta.id,
            meta: {id: meta.id, name: meta.name, seed: String(meta.seed || document.seed || DEFAULT_WORLD_SEED)},
            document,
        });
        migrated = true;
    }
    if (!migrated && (window.localStorage.getItem(WORLD_STORAGE_KEY) || window.localStorage.getItem(LEGACY_STORAGE_KEY))) {
        const state = useStore.getState();
        if (!existingIds.has(state.worldUid)) await worldApi.import({
                format: "minecraft-react-export", version: 1, newId: state.worldUid,
                meta: {id: state.worldUid, name: state.worldName, seed: state.seed},
                document: JSON.parse(serializeWorld(state)),
            });
        migrated = true;
    }
    return {complete: !invalid, activeId};
}

async function startPersistence() {
    await worldApi.health();
    const packs = savedDataPacks();
    for (const pack of packs) {
        if (registerDataPack(pack).ok) await worldApi.savePack(pack);
    }
    if (packs.length) window.localStorage.removeItem(DATA_PACKS_KEY);

    let {worlds} = await worldApi.list();
    const migration = await migrateLegacyWorlds(new Set(worlds.map((world) => world.id)));
    if (!migration.complete) throw new Error("A browser save is invalid. It was kept in localStorage for recovery.");
    let migrationComplete = migration.complete;
    if (migrationComplete) {
        ({worlds} = await worldApi.list());
    }
    if (!worlds.length) {
        const state = useStore.getState();
        await worldApi.create({
            id: state.worldUid,
            name: state.worldName,
            seed: state.seed,
            settings: {document: remoteDocument(state)},
            player: {position: state.playerPosition, positionVersion: 0, state: {mountedEntityId: state.mountedEntityId}},
        });
        migrationComplete = true;
        ({worlds} = await worldApi.list());
    }

    const remotePacks = await worldApi.listPacks();
    remotePacks.packs.forEach((pack) => registerDataPack(pack));
    const selectedWorld = worlds.find((world) => world.id === migration.activeId) ?? worlds[0];
    const payload = await worldApi.load(selectedWorld.id);
    useStore.getState().hydrateRemoteWorld(payload, worlds);
    const state = useStore.getState();
    await state.loadRemoteRegion(state.playerChunk[0], state.playerChunk[1], state.renderDistance);
    if (migrationComplete) clearLegacyStorage();
    return true;
}

export function initializePersistence() {
    if (!startupPromise) startupPromise = startPersistence().catch((error) => {
        startupPromise = null;
        throw error;
    });
    return startupPromise;
}
