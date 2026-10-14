import {useEffect, useState} from "react";
import {useStore} from "../hooks/useStore";
import {biomeAt} from "../world/terrain";
import {lightAt} from "../world/lighting";
import {worldApi} from "../api/worldApi";

export const AdvancedShortcuts = () => {
    const toggleDebug = useStore((state) => state.toggleDebug);
    const toggleMap = useStore((state) => state.toggleMap);
    useEffect(() => {
        const listener = (event) => {
            if (event.code === "F3") { event.preventDefault(); toggleDebug(); }
            if (event.code === "KeyM" && !/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) toggleMap();
        };
        document.addEventListener("keydown", listener);
        return () => document.removeEventListener("keydown", listener);
    }, [toggleDebug, toggleMap]);
    return null;
};

export const DebugOverlay = () => {
    const open = useStore((state) => state.debugOpen);
    const position = useStore((state) => state.playerPosition);
    const seed = useStore((state) => state.seed);
    const dimension = useStore((state) => state.dimension);
    const chunks = useStore((state) => state.chunks);
    const levels = useStore((state) => state.blockLight);
    const active = useStore((state) => state.activeChunkKeys);
    const time = useStore((state) => state.worldTime);
    const metrics = useStore((state) => state.renderMetrics);
    if (!open) return null;
    const rounded = position.map(Math.round);
    return <aside className="debug-overlay">
        <strong>{dimension === "dream_grove" ? "Dream Grove" : "Overworld"}</strong>
        <span>XYZ: {position.map((value) => value.toFixed(1)).join(" / ")}</span>
        <span>Chunk: {Math.floor(position[0] / 16)}, {Math.floor(position[2] / 16)}</span>
        <span>Biome: {biomeAt(seed, position[0], position[2])}</span>
        <span>Light: {lightAt(chunks, levels, rounded)}</span>
        <span>World time: {Math.floor(time)}s</span>
        <span>Active chunks: {active.length}</span>
        {metrics && <>
            <span>Frame: {metrics.frameMs.toFixed(1)} ms (p95 {metrics.frameP95Ms.toFixed(1)})</span>
            <span>Draw calls: {metrics.drawCalls} · Triangles: {metrics.triangles.toLocaleString()}</span>
            <span>GPU: {metrics.geometries} geometries · {metrics.textures} textures · ~{metrics.gpuMb.toFixed(1)} MB buffers</span>
            <span>Mesh p95: worker {metrics.workerMeshMs.toFixed(1)} ms · install {metrics.meshInstallMs.toFixed(1)} ms</span>
            <span>Layers: O {metrics.layers.opaque.toLocaleString()} · C {metrics.layers.cutout.toLocaleString()} · T {metrics.layers.translucent.toLocaleString()} · E {metrics.layers.emissive.toLocaleString()}</span>
            <span>Objects: furniture {metrics.objects.furniture.toLocaleString()} · decor {metrics.objects.decor.toLocaleString()} · outdoor {metrics.objects.outdoor.toLocaleString()}</span>
            <span>Budget D{metrics.budgetDistance}: {Object.values(metrics.withinBudget).every(Boolean) ? "within target" : `over ${Object.entries(metrics.withinBudget).filter(([, passing]) => !passing).map(([name]) => name).join(", ")}`}</span>
            {[2, 4, 6, 9].map((distance) => metrics.distanceProfiles[distance] && <span key={distance}>
                D{distance}: {metrics.distanceProfiles[distance].frameMs.toFixed(1)} ms · {metrics.distanceProfiles[distance].drawCalls} calls · {metrics.distanceProfiles[distance].triangles.toLocaleString()} tris
            </span>)}
        </>}
    </aside>;
};

export const MapPanel = () => {
    const open = useStore((state) => state.mapOpen);
    const toggle = useStore((state) => state.toggleMap);
    const position = useStore((state) => state.playerPosition);
    const dimension = useStore((state) => state.dimension);
    const explored = useStore((state) => state.exploredColumns);
    const biomes = useStore((state) => state.discoveredBiomes);
    const markers = useStore((state) => state.markers);
    const structures = useStore((state) => state.discoveredStructures);
    const goals = useStore((state) => state.goals);
    const addMarker = useStore((state) => state.addMarker);
    const removeMarker = useStore((state) => state.removeMarker);
    const [name, setName] = useState("");
    const visibleMarkers = markers.filter((marker) => marker.dimension === dimension);
    const nearest = visibleMarkers.map((marker) => ({...marker, distance: Math.hypot(marker.position[0] - position[0], marker.position[2] - position[2])})).sort((a, b) => a.distance - b.distance)[0];
    const centerChunk = [Math.floor(position[0] / 16), Math.floor(position[2] / 16)];
    if (!open) return null;
    return <div className="advanced-backdrop" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}><section className="advanced-panel">
        <header><strong>Exploration map · {dimension}</strong><button onClick={toggle}>×</button></header>
        <div className="map-summary"><b>{Array.from(explored).filter((key) => key.startsWith(`${dimension}:`)).length}</b> explored chunks · <b>{Array.from(biomes).filter((key) => key.startsWith(`${dimension}:`)).length}</b> biomes · <b>{structures.filter((item) => item.id.startsWith(`${dimension}:`)).length}</b> structures</div>
        <div className="exploration-map" aria-label="Explored chunk map">{Array.from({length: 121}, (_, index) => {
            const x = centerChunk[0] + index % 11 - 5;
            const z = centerChunk[1] + Math.floor(index / 11) - 5;
            const visited = explored.has(`${dimension}:${x},${z}`);
            const current = x === centerChunk[0] && z === centerChunk[1];
            return <span key={`${x},${z}`} className={`${visited ? "visited" : ""} ${current ? "current" : ""}`} title={`${x}, ${z}`}/>;
        })}</div>
        {nearest && <p>Compass: {nearest.name} is {Math.round(nearest.distance)} blocks away ({nearest.position[0]}, {nearest.position[2]}).</p>}
        <div className="marker-form"><input value={name} placeholder="Marker name" onChange={(event) => setName(event.target.value)}/><button onClick={() => { addMarker(name); setName(""); }}>Mark current position</button></div>
        <ul>{visibleMarkers.map((marker) => <li key={marker.id}><span style={{color: marker.color}}>◆</span> {marker.name} — {marker.position.join(", ")} <button onClick={() => removeMarker(marker.id)}>Remove</button></li>)}</ul>
        <h3>Peaceful goals</h3>
        <div className="goals">Explore: {goals.explored ?? 0}/25 · Place: {goals.blocksPlaced ?? 0}/50 · Mine: {goals.blocksMined ?? 0}/50 · Craft: {goals.crafted ?? 0}/20 · Harvest: {goals.harvests ?? 0}/10 · Friendship: {goals.friendships ?? 0}/5 · Structures: {goals.structures ?? 0}/3 · Dimensions: {goals.dimensions ?? 1}/2</div>
    </section></div>;
};

export const WorldManager = () => {
    const open = useStore((state) => state.worldManagerOpen);
    const close = useStore((state) => state.toggleWorldManager);
    const activeId = useStore((state) => state.worldUid);
    const createWorld = useStore((state) => state.createManagedWorld);
    const openWorld = useStore((state) => state.openRemoteWorld);
    const refreshWorlds = useStore((state) => state.refreshWorlds);
    const saveWorld = useStore((state) => state.saveWorld);
    const worlds = useStore((state) => state.worlds);
    const gameRules = useStore((state) => state.gameRules);
    const setGameRule = useStore((state) => state.setGameRule);
    const [name, setName] = useState("New World");
    const [seed, setSeed] = useState("");
    const [importText, setImportText] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    useEffect(() => { if (open) refreshWorlds().catch((value) => setError(value.message)); }, [open, refreshWorlds]);
    if (!open) return null;
    const run = async (operation) => {
        setBusy(true); setError("");
        try { await operation(); } catch (value) { setError(value.message); }
        finally { setBusy(false); }
    };
    const download = async (world) => {
        if (!(await saveWorld("manual"))) throw new Error("Save the current world before exporting");
        const value = await worldApi.export(world.id);
        const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], {type: "application/json"})); link.download = `${world.name}.json`; link.click(); URL.revokeObjectURL(link.href);
    };
    return <div className="advanced-backdrop" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}><section className="advanced-panel world-manager">
        <header><strong>Worlds</strong><button onClick={close}>×</button></header>
        {error && <p className="pack-error">{error}</p>}
        {worlds.map((world) => <div className="world-row" key={world.id}><div><b>{world.name}</b><small>Seed: {world.seed}</small></div><button disabled={busy || world.id === activeId} onClick={() => run(async () => { await openWorld(world.id); close(); })}>Open</button><button disabled={busy} onClick={() => run(async () => { if (!(await saveWorld("manual"))) throw new Error("Save failed"); await worldApi.duplicate(world.id, `world-${Date.now()}`); await refreshWorlds(); })}>Duplicate</button><button disabled={busy} onClick={() => run(() => download(world))}>Export</button><button disabled={busy} onClick={() => { if (window.confirm(`Delete ${world.name}?`)) run(async () => { await worldApi.delete(world.id); const remaining = await refreshWorlds(); if (world.id === activeId) { if (remaining[0]) await openWorld(remaining[0].id, false); else await createWorld("My World", "minecraft-react"); } }); }}>Delete</button></div>)}
        <h3>Create world</h3><div className="marker-form"><input value={name} onChange={(event) => setName(event.target.value)}/><input value={seed} placeholder="Seed" onChange={(event) => setSeed(event.target.value)}/><button disabled={busy} onClick={() => run(async () => { await createWorld(name, seed); close(); })}>Create</button></div>
        <h3>Current world rules</h3><div className="world-rules">{Object.entries(gameRules).map(([rule, enabled]) => <label key={rule}><input type="checkbox" checked={enabled} onChange={(event) => setGameRule(rule, event.target.checked)}/>{rule}</label>)}</div>
        <h3>Import world</h3><textarea value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="Paste exported world JSON"/><button disabled={busy} onClick={() => run(async () => { const value = JSON.parse(importText); await worldApi.import({...value, newId: `world-${Date.now()}`}); await refreshWorlds(); setImportText(""); })}>Import</button>
    </section></div>;
};

export const DataPackManager = () => {
    const open = useStore((state) => state.packsOpen);
    const toggle = useStore((state) => state.togglePacks);
    const importPack = useStore((state) => state.importDataPack);
    const enabled = useStore((state) => state.enabledPacks);
    const [text, setText] = useState("");
    const [errors, setErrors] = useState([]);
    if (!open) return null;
    return <div className="advanced-backdrop" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}><section className="advanced-panel"><header><strong>Data packs</strong><button onClick={toggle}>×</button></header><p>Enabled: {enabled.join(", ") || "None"}</p><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder={'{"version":1,"namespace":"example","blocks":[{"id":"blue_brick","name":"Blue Brick","color":"#3977bb"}]}'}/>{errors.map((error) => <p className="pack-error" key={error}>{error}</p>)}<button onClick={async () => { const result = await importPack(text); setErrors(result.errors); if (result.ok) setText(""); }}>Validate and enable</button></section></div>;
};
