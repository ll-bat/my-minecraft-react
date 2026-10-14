import {useEffect} from "react";
import {useStore} from "../hooks/useStore";

export const AUTO_SAVE_INTERVAL_MS = 2500;

// These values contribute to a database save. Reference checks are enough
// because the store replaces persistent arrays, maps, and sets when they change.
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
        let dirtyVersion = 0;
        let savedVersion = 0;
        let saving = false;
        let idleSave = null;

        const unsubscribe = useStore.subscribe((state, previousState) => {
            if (persistentWorldChanged(state, previousState)) dirtyVersion += 1;
        });

        const saveNow = async () => {
            if (dirtyVersion === savedVersion || saving) return;
            saving = true;
            const capturedVersion = dirtyVersion;
            try {
                const saved = await useStore.getState().saveWorld("auto");
                if (saved) savedVersion = capturedVersion;
            } finally {
                saving = false;
            }
        };

        const scheduleSave = () => {
            if (dirtyVersion === savedVersion || saving || idleSave !== null) return;
            if (typeof window.requestIdleCallback === "function") {
                idleSave = window.requestIdleCallback(() => {
                    idleSave = null;
                    void saveNow();
                }, {timeout: 400});
            } else {
                void saveNow();
            }
        };

        const flush = () => {
            if (idleSave !== null && typeof window.cancelIdleCallback === "function") {
                window.cancelIdleCallback(idleSave);
                idleSave = null;
            }
            void useStore.getState().savePlayerPosition(true);
            void saveNow();
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
