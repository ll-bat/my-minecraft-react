import {useEffect, useState} from "react";
import {useStore} from "../hooks/useStore";

export const Menu = () => {
    const worldSeed = useStore((state) => state.seed);
    const saveStatus = useStore((state) => state.saveStatus);
    const saveWorld = useStore((state) => state.saveWorld);
    const resetWorld = useStore((state) => state.resetWorld);
    const createWorld = useStore((state) => state.createWorld);
    const gameMode = useStore((state) => state.gameMode);
    const setGameMode = useStore((state) => state.setGameMode);
    const renderDistance = useStore((state) => state.renderDistance);
    const setRenderDistance = useStore((state) => state.setRenderDistance);
    const toggleWorldManager = useStore((state) => state.toggleWorldManager);
    const toggleMap = useStore((state) => state.toggleMap);
    const togglePacks = useStore((state) => state.togglePacks);
    const [seed, setSeed] = useState(worldSeed);

    useEffect(() => setSeed(worldSeed), [worldSeed]);

    const handleReset = () => {
        if (window.confirm(`Regenerate world "${worldSeed}"? Unsaved changes will be removed.`)) {
            resetWorld();
        }
    };

    const handleCreate = () => {
        if (window.confirm(`Create a new world using seed "${seed || "minecraft-react"}"?`)) {
            createWorld(seed);
        }
    };

    return (
        <div className="menu" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
            <label>
                Seed
                <input
                    value={seed}
                    onChange={(event) => setSeed(event.target.value)}
                    onKeyDown={(event) => event.stopPropagation()}
                />
            </label>
            <button type="button" onClick={handleCreate}>New world</button>
            <button type="button" onClick={saveWorld}>Save</button>
            <button type="button" onClick={handleReset}>Regenerate</button>
            <button type="button" onClick={toggleWorldManager}>Worlds</button>
            <button type="button" onClick={toggleMap}>Map</button>
            <button type="button" onClick={togglePacks}>Packs</button>
            <label>
                Mode
                <select value={gameMode} onChange={(event) => setGameMode(event.target.value)}>
                    <option value="survival">Survival</option>
                    <option value="creative">Creative</option>
                </select>
            </label>
            <label>
                View
                <select value={renderDistance} onChange={(event) => setRenderDistance(Number(event.target.value))}>
                    <option value={1}>1 · Low</option>
                    <option value={2}>2 · Medium</option>
                    <option value={3}>3 · High</option>
                    <option value={4}>4 · Ultra</option>
                </select>
            </label>
            <span role="status">{saveStatus}</span>
        </div>
    );
};
