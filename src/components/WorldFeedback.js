import {useFrame, useThree} from "@react-three/fiber";
import {useEffect, useMemo, useRef, useState} from "react";
import {Euler, Vector3} from "three";
import {useStore} from "../hooks/useStore";
import {BLOCK_BY_ID} from "../world/blocks";
import {emittedLight, lightSources} from "../world/lighting";
import {BlockItemMesh, ItemArtworkMesh} from "./BlockItemMesh";
import {ITEM_BY_ID} from "../world/items";
import {getBlock} from "../world/chunks";
import {ModelItemMesh} from "./ModelObjects";

const SOUND_FREQUENCIES = {place: 190, break: 120, step: 90, water: 150, open: 260, toggle: 220, switch: 320, rest: 410, till: 140, plant: 280, harvest: 360, creature: 460, pickup: 520, ambient: 70};
const MAX_DYNAMIC_LIGHTS = 8;

function playTone(type) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type === "water" ? "sine" : "square";
    oscillator.frequency.value = SOUND_FREQUENCIES[type] ?? 180;
    gain.gain.setValueAtTime(0.025, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.09);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.1);
    oscillator.onended = () => context.close();
}

export const GameAudio = () => {
    const sound = useStore((state) => state.soundEvent);
    useEffect(() => {
        if (sound && document.pointerLockElement) playTone(sound.type);
    }, [sound]);
    useEffect(() => {
        const timer = window.setInterval(() => {
            if (document.pointerLockElement) playTone("ambient");
        }, 18000);
        return () => window.clearInterval(timer);
    }, []);
    return null;
};

const Smoke = ({position}) => {
    const ref = useRef();
    useFrame(({clock}) => {
        if (ref.current) ref.current.position.y = 0.7 + (clock.elapsedTime % 1.5) * 0.7;
    });
    return <group ref={ref} position={position}>
        <mesh scale={0.13}><sphereGeometry args={[1, 8, 8]}/><meshBasicMaterial color="#777" opacity={0.45} transparent/></mesh>
        <mesh position={[0.12, 0.18, 0]} scale={0.09}><sphereGeometry args={[1, 8, 8]}/><meshBasicMaterial color="#aaa" opacity={0.35} transparent/></mesh>
    </group>;
};

export const FurnaceSmoke = () => {
    const entities = useStore((state) => state.blockEntities);
    return Array.from(entities)
        .filter(([, entity]) => entity.type === "furnace" && entity.burnRemaining > 0)
        .map(([key]) => <Smoke key={key} position={key.split(",").map(Number)}/>);
};

export const InteractionFeedback = () => {
    const feedback = useStore((state) => state.interactionFeedback);
    const clear = useStore((state) => state.clearInteractionFeedback);
    useEffect(() => {
        if (!feedback) return undefined;
        const timer = window.setTimeout(clear, 3000);
        return () => window.clearTimeout(timer);
    }, [clear, feedback]);
    return feedback ? <div className="interaction-feedback" role="status">{feedback}</div> : null;
};

export const WorldLights = () => {
    const lightSourceRevision = useStore((state) => state.lightSourceRevision);
    const worldId = useStore((state) => state.worldId);
    const playerChunk = useStore((state) => state.playerChunk);
    const allSources = useMemo(() => {
        if (!Number.isFinite(lightSourceRevision) || !Number.isFinite(worldId)) return [];
        const {chunks, blockLight} = useStore.getState();
        return lightSources(blockLight, 14).filter(({position}) => emittedLight(getBlock(chunks, position)) > 0);
    }, [lightSourceRevision, worldId]);
    const sources = useMemo(() => {
        const playerX = playerChunk[0] * 16 + 8;
        const playerZ = playerChunk[1] * 16 + 8;
        return allSources.map((source) => ({
            ...source,
            distance: Math.hypot(source.position[0] - playerX, source.position[2] - playerZ),
        })).filter(({distance}) => distance < 44)
            .sort((left, right) => left.distance - right.distance)
            .slice(0, MAX_DYNAMIC_LIGHTS);
    }, [allSources, playerChunk]);
    return sources.map(({position, level}) => (
        <pointLight key={position.join(",")} position={position} color="#ffd37a" distance={level} intensity={0.9}/>
    ));
};

export const BlockParticles = () => {
    const event = useStore((state) => state.particleEvent);
    const [visible, setVisible] = useState(null);
    useEffect(() => {
        if (!event) return undefined;
        setVisible(event);
        const timer = window.setTimeout(() => setVisible(null), 450);
        return () => window.clearTimeout(timer);
    }, [event]);
    if (!visible) return null;
    const color = visible.type === "power" ? "#ffd85a" : visible.type === "harvest" ? "#dfbd55" : "#b99a74";
    return <group position={visible.position}>
        {Array.from({length: 10}, (_, index) => (
            <mesh key={index} position={[(index % 3 - 1) * 0.22, 0.2 + (index % 4) * 0.13, (Math.floor(index / 3) - 1) * 0.2]} scale={0.08}>
                <boxGeometry/><meshBasicMaterial color={color}/>
            </mesh>
        ))}
    </group>;
};

export const HeldItem = () => {
    const ref = useRef();
    const {camera} = useThree();
    const inventory = useStore((state) => state.inventory);
    const selected = useStore((state) => state.selectedHotbar);
    const sound = useStore((state) => state.soundEvent);
    const stack = inventory[selected];
    const item = stack ? ITEM_BY_ID[stack.itemId] : null;
    const block = item?.blockId ? BLOCK_BY_ID[item.blockId] : null;
    const started = useRef(0);
    useEffect(() => { started.current = performance.now(); }, [sound]);
    useFrame(({clock}) => {
        if (!ref.current) return;
        const forward = camera.getWorldDirection(new Vector3());
        const right = new Vector3(1, 0, 0).applyEuler(camera.rotation);
        const bob = Math.sin(clock.elapsedTime * 7) * 0.015;
        const swing = Math.max(0, 1 - (performance.now() - started.current) / 220) * 0.18;
        ref.current.position.copy(camera.position).add(forward.multiplyScalar(0.8)).add(right.multiplyScalar(0.32));
        ref.current.position.y -= 0.28 + swing - bob;
        ref.current.rotation.copy(new Euler(camera.rotation.x - 0.25, camera.rotation.y - 0.35, camera.rotation.z + 0.2));
    });
    if (!item) return null;
    if (block?.modelUrl) {
        return <ModelItemMesh ref={ref} block={block} scale={0.32} raycast={() => null}/>;
    }
    if (!block && item.artwork) {
        return <ItemArtworkMesh ref={ref} artwork={item.artwork} scale={0.3} raycast={() => null}/>;
    }
    return <BlockItemMesh
        ref={ref}
        block={block}
        color={item.uiColor ?? "#cccccc"}
        scale={0.22}
        raycast={() => null}
    />;
};
