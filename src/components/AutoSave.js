import {useEffect} from "react";
import {useStore} from "../hooks/useStore";

export const AUTO_SAVE_INTERVAL_MS = 2500;

// These are the values written by serializeWorld, plus the world metadata used
// to choose the localStorage document. Reference checks are enough because the
// store replaces persistent arrays, maps, and sets when they change.
export const PERSISTENT_WORLD_KEYS = [
    "seed",
    "worldUid",
    "worldName",
    "worldCreatedAt",
    "texture",
    "playerPosition",
    "generatedColumns",
    "fluidLevels",
    "inventory",
    "survivalInventory",
    "selectedHotbar",
    "gameMode",
    "renderDistance",
    "drops",
    "playerCrafting",
    "tableCrafting",
    "blockEntities",
    "blockStates",
    "scheduledUpdates",
    "worldTime",
    "dimension",
    "dimensionSnapshots",
    "exploredColumns",
    "discoveredBiomes",
    "markers",
    "discoveredStructures",
    "goals",
    "gameRules",
    "enabledPacks",
    "entities",
    "spawnedCreatureGroups",
    "chunks",
];

export function persistentWorldChanged(state, previousState) {
    return PERSISTENT_WORLD_KEYS.some((key) => state[key] !== previousState[key]);
}

export function AutoSave() {
    useEffect(() => {
        let dirty = false;
        let saving = false;
        let idleSave = null;

        const unsubscribe = useStore.subscribe((state, previousState) => {
            if (persistentWorldChanged(state, previousState)) dirty = true;
        });

        const saveNow = () => {
            if (!dirty || saving) return;
            saving = true;
            const saved = useStore.getState().saveWorld("auto");
            if (saved) dirty = false;
            saving = false;
        };

        const scheduleSave = () => {
            if (!dirty || saving || idleSave !== null) return;
            if (typeof window.requestIdleCallback === "function") {
                idleSave = window.requestIdleCallback(() => {
                    idleSave = null;
                    saveNow();
                }, {timeout: 400});
            } else {
                saveNow();
            }
        };

        const flush = () => {
            if (idleSave !== null && typeof window.cancelIdleCallback === "function") {
                window.cancelIdleCallback(idleSave);
                idleSave = null;
            }
            saveNow();
        };

        const interval = window.setInterval(scheduleSave, AUTO_SAVE_INTERVAL_MS);
        const saveWhenHidden = () => {
            if (document.visibilityState === "hidden") flush();
        };
        document.addEventListener("visibilitychange", saveWhenHidden);
        window.addEventListener("pagehide", flush);

        return () => {
            window.clearInterval(interval);
            if (idleSave !== null && typeof window.cancelIdleCallback === "function") {
                window.cancelIdleCallback(idleSave);
            }
            document.removeEventListener("visibilitychange", saveWhenHidden);
            window.removeEventListener("pagehide", flush);
            unsubscribe();
        };
    }, []);

    return null;
}
