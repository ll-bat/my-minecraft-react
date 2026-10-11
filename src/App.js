import {Canvas} from "@react-three/fiber";
import {Physics} from "@react-three/cannon";
import {Player} from "./components/Player";
import {FPV} from "./components/FPV";
import {Menu} from "./components/Menu"
import {TextureSelector} from "./components/TextureSelector";
import {ChunkWorld} from "./components/ChunkWorld";
import {WorldEnvironment} from "./components/WorldEnvironment";
import {FluidSimulation} from "./components/FluidSimulation";
import {Inventory} from "./components/Inventory";
import {ItemDrops} from "./components/ItemDrops";
import {FurnaceSimulation} from "./components/FurnaceSimulation";
import {CommunityPanel, CreatureFeedback, Creatures} from "./components/Creatures";
import {CreatureSimulation} from "./components/CreatureSimulation";
import {BlockSimulation} from "./components/BlockSimulation";
import {BlockParticles, FurnaceSmoke, GameAudio, HeldItem, InteractionFeedback, WorldLights} from "./components/WorldFeedback";
import {AdvancedShortcuts, DataPackManager, DebugOverlay, MapPanel, WorldManager} from "./components/AdvancedUI";
import {RenderingDiagnostics} from "./components/RenderingDiagnostics";
import {AmbientSky} from "./components/AmbientSky";

function App() {
    return (
        <>
            <Canvas onContextMenu={(event) => event.preventDefault()}>
                <RenderingDiagnostics/>
                <WorldEnvironment/>
                <WorldLights/>
                <AmbientSky/>
                <FPV/>
                <Physics>
                    <ChunkWorld/>
                    <ItemDrops/>
                    <Creatures/>
                    <Player/>
                </Physics>
                <BlockParticles/>
                <FurnaceSmoke/>
                <HeldItem/>
            </Canvas>
            <TextureSelector/>
            <FluidSimulation/>
            <FurnaceSimulation/>
            <CreatureSimulation/>
            <BlockSimulation/>
            <GameAudio/>
            <div className='absolute centered cursor'/>
            <Menu/>
            <Inventory/>
            <CreatureFeedback/>
            <CommunityPanel/>
            <InteractionFeedback/>
            <AdvancedShortcuts/>
            <DebugOverlay/>
            <MapPanel/>
            <WorldManager/>
            <DataPackManager/>
        </>
    )
}

export default App
