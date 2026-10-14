import {useEffect, useState} from "react";
import {useStore} from "../hooks/useStore";
import {DAY_PERIODS, dayPeriodForWorldTime, WEATHER_OPTIONS} from "../world/sky";

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
    const worldTime = useStore((state) => state.worldTime);
    const setDayPeriod = useStore((state) => state.setDayPeriod);
    const skyWeather = useStore((state) => state.skyWeather);
    const setSkyWeather = useStore((state) => state.setSkyWeather);
    const [seed, setSeed] = useState(worldSeed);

    useEffect(() => setSeed(worldSeed), [worldSeed]);

    const handleReset = () => {
        if (window.confirm(`Regenerate world "${worldSeed}"? All saved progress for this world will be permanently removed.`)) {
            resetWorld();
        }
    };

    const handleCreate = () => {
        if (window.confirm(`Create a new world using seed "${seed || "minecraft-react"}"? All saved progress for the current world will be permanently removed.`)) {
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
                Time
                <select value={dayPeriodForWorldTime(worldTime)} onChange={(event) => setDayPeriod(event.target.value)}>
                    {DAY_PERIODS.map((period) => (
                        <option key={period.id} value={period.id}>{period.label}</option>
                    ))}
                </select>
            </label>
            <label>
                Weather
                <select value={skyWeather} onChange={(event) => setSkyWeather(event.target.value)}>
                    {WEATHER_OPTIONS.map((weather) => (
                        <option key={weather.id} value={weather.id}>{weather.label}</option>
                    ))}
                </select>
            </label>
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
                    <option value={6}>6 · Extra</option>
                    <option value={9}>9 · Extra 2x</option>
                </select>
            </label>
            <span role="status">{saveStatus}</span>
        </div>
    );
};
