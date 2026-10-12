import {useFrame} from "@react-three/fiber";
import {useBox} from "@react-three/cannon";
import {Suspense, useEffect, useRef} from "react";
import {useStore} from "../hooks/useStore";
import {CREATURE_TYPES, isNightTime, VILLAGER_PROFESSIONS} from "../world/entities";
import {isDestructiveTool, ITEM_BY_ID} from "../world/items";
import {HorseModel, HumanModel, SheepModel, WatercraftModel} from "./CreatureModels";

const Box = ({position, scale, color, emissive}) => (
    <mesh position={position} scale={scale}>
        <boxGeometry/>
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={emissive ? 0.75 : 0}/>
    </mesh>
);

const WatercraftCollider = ({entity}) => {
    const ship = entity.type === "ship";
    const size = ship ? [2.3, 0.32, 4.4] : [1.45, 0.3, 2.35];
    const deckHeight = ship ? 1.02 : 0.52;
    const [ref, api] = useBox(() => ({
        args: size,
        position: [entity.position[0], entity.position[1] + deckHeight, entity.position[2]],
        rotation: [0, entity.heading, 0],
        type: "Kinematic",
    }));
    useEffect(() => {
        api.position.set(entity.position[0], entity.position[1] + deckHeight, entity.position[2]);
        api.rotation.set(0, entity.heading, 0);
    }, [api.position, api.rotation, deckHeight, entity.heading, entity.position]);
    return <mesh ref={ref} visible={false}><boxGeometry args={size}/></mesh>;
};

const WatercraftInteractionVolume = ({type}) => {
    const ship = type === "ship";
    return <mesh position={[0, ship ? 2.25 : 0.45, 0]}>
        <boxGeometry args={ship ? [3, 4.7, 5.4] : [2.8, 0.9, 3]}/>
        <meshBasicMaterial transparent opacity={0} depthWrite={false}/>
    </mesh>;
};

const CreatureModel = ({entity}) => {
    if (entity.type === "villager") {
        return <HumanModel entity={entity} walking={entity.animationState === "walking"}/>;
    }
    if (entity.type === "horse") {
        return <HorseModel walking={entity.animationState === "walking"}/>;
    }
    if (entity.type === "sheep") {
        return <SheepModel walking={entity.animationState === "walking"}/>;
    }
    if (CREATURE_TYPES[entity.type]?.watercraft) {
        return <WatercraftModel type={entity.type}/>;
    }
    if (entity.type === "minecart") {
        return <>
            <Box position={[0, 0.35, 0]} scale={[1.2, 0.62, 1.45]} color="#7f878d"/>
            <Box position={[0, 0.62, 0]} scale={[0.92, 0.32, 1.12]} color="#363b3e"/>
            {[-0.55, 0.55].flatMap((x) => [-0.48, 0.48].map((z) => <Box key={`${x}:${z}`} position={[x, 0.05, z]} scale={[0.22, 0.35, 0.35]} color="#2b2d2f"/>))}
        </>;
    }
    if (entity.type.startsWith("fish_")) {
        const palette = {
            fish_blue: ["#4597da", "#8ed8f2", "#225f9d"],
            fish_orange: ["#f28a32", "#ffd06b", "#bd4d25"],
            fish_pink: ["#e76e9d", "#ffc0d4", "#a63e78"],
        }[entity.type];
        return <>
            <mesh position={[0, 0.02, 0]} scale={[0.38, 0.38, 0.72]}>
                <sphereGeometry args={[0.72, 8, 6]}/>
                <meshStandardMaterial color={palette[0]} flatShading roughness={0.72}/>
            </mesh>
            <mesh position={[0, 0, -0.72]} rotation={[Math.PI / 2, 0, 0]} scale={[0.55, 0.5, 0.22]}>
                <coneGeometry args={[0.62, 0.9, 3]}/>
                <meshStandardMaterial color={palette[2]} flatShading/>
            </mesh>
            <mesh position={[0, 0.34, -0.03]} rotation={[0, 0, Math.PI / 4]} scale={[0.28, 0.1, 0.38]}>
                <coneGeometry args={[0.5, 0.7, 3]}/>
                <meshStandardMaterial color={palette[1]} flatShading/>
            </mesh>
            <Box position={[-0.24, 0.12, 0.48]} scale={[0.08, 0.08, 0.08]} color="#172332"/>
            <Box position={[0.24, 0.12, 0.48]} scale={[0.08, 0.08, 0.08]} color="#172332"/>
        </>;
    }
    if (entity.type === "rabbit") {
        return <>
            <Box position={[0, 0.35, 0]} scale={[0.65, 0.55, 0.9]} color="#b88455"/>
            <Box position={[0, 0.62, 0.48]} scale={[0.48, 0.48, 0.45]} color="#c49364"/>
            <Box position={[-0.14, 1.02, 0.48]} scale={[0.14, 0.65, 0.14]} color="#c49364"/>
            <Box position={[0.14, 1.02, 0.48]} scale={[0.14, 0.65, 0.14]} color="#c49364"/>
        </>;
    }
    if (entity.type === "glow_sprite") {
        return <>
            <Box position={[0, 0.55, 0]} scale={[0.65, 0.65, 0.65]} color="#ffe66d" emissive="#ffc928"/>
            <Box position={[-0.46, 0.55, 0]} scale={[0.25, 0.5, 0.08]} color="#bff4ff" emissive="#5fdfff"/>
            <Box position={[0.46, 0.55, 0]} scale={[0.25, 0.5, 0.08]} color="#bff4ff" emissive="#5fdfff"/>
        </>;
    }
    return <>
        <Box position={[0, 0.55, 0]} scale={[1.2, 0.85, 0.75]} color="#eee9df"/>
        <Box position={[0, 0.62, 0.55]} scale={[0.58, 0.58, 0.48]} color="#77716b"/>
        {[-0.42, 0.42].flatMap((x) => [-0.25, 0.25].map((z) => (
            <Box key={`${x}:${z}`} position={[x, 0.05, z]} scale={[0.16, 0.65, 0.16]} color="#5d5752"/>
        )))}
    </>;
};

const Creature = ({entity, mounted = false}) => {
    const ref = useRef();
    const interactCreature = useStore((state) => state.interactCreature);
    const destroyEntityWithSelectedTool = useStore((state) => state.destroyEntityWithSelectedTool);
    const selectedTool = useStore((state) => {
        const stack = state.inventory[state.selectedHotbar];
        return isDestructiveTool(stack ? ITEM_BY_ID[stack.itemId] : null);
    });
    useFrame(({camera, clock}) => {
        if (!ref.current) return;
        if (mounted) {
            const riderOffset = CREATURE_TYPES[entity.type]?.riderOffset ?? 0.55;
            ref.current.position.set(camera.position.x, camera.position.y - riderOffset, camera.position.z);
            ref.current.rotation.y = camera.rotation.y;
            return;
        }
        const swimming = entity.type.startsWith("fish_");
        const articulated = entity.type === "sheep" || entity.type === "horse" || entity.type === "villager";
        const bob = entity.animationState === "walking" && !articulated ? Math.abs(Math.sin(clock.elapsedTime * 7)) * 0.08
            : swimming ? Math.sin(clock.elapsedTime * 2.4 + entity.position[0]) * 0.035 : 0;
        const happy = entity.animationState === "happy" ? Math.sin(clock.elapsedTime * 8) * 0.08 : 0;
        ref.current.position.set(entity.position[0], entity.position[1] + bob + happy, entity.position[2]);
        ref.current.rotation.y = entity.heading + (swimming ? Math.sin(clock.elapsedTime * 5.5) * 0.11 : 0);
    });
    return (<>
        <group
            ref={ref}
            position={entity.position}
            onPointerDown={(event) => {
                event.stopPropagation();
                const button = event.button ?? event.nativeEvent?.button;
                if (button === 0 && selectedTool) {
                    destroyEntityWithSelectedTool(entity.id);
                    return;
                }
                if (CREATURE_TYPES[entity.type]?.rideable && button !== 2) return;
                if (button === 2) event.nativeEvent?.preventDefault();
                interactCreature(entity.id);
            }}
        >
            <Suspense fallback={null}><CreatureModel entity={entity}/></Suspense>
            {CREATURE_TYPES[entity.type]?.watercraft && <WatercraftInteractionVolume type={entity.type}/>}
            {entity.animationState === "happy" && (
                <Box position={[0, 1.65, 0]} scale={[0.18, 0.18, 0.18]} color="#ff5277" emissive="#ff315d"/>
            )}
        </group>
        {CREATURE_TYPES[entity.type]?.watercraft && !mounted && <WatercraftCollider entity={entity}/>}
    </>);
};

export const Creatures = () => {
    const entities = useStore((state) => state.entities);
    const playerPosition = useStore((state) => state.playerPosition);
    const worldTime = useStore((state) => state.worldTime);
    const feedback = useStore((state) => state.creatureFeedback);
    const clearFeedback = useStore((state) => state.clearCreatureFeedback);
    const mountedEntityId = useStore((state) => state.mountedEntityId);
    useEffect(() => {
        if (!feedback) return undefined;
        const timer = window.setTimeout(clearFeedback, 3500);
        return () => window.clearTimeout(timer);
    }, [clearFeedback, feedback]);

    return <>
        {entities.filter((entity) => (
            (entity.id !== mountedEntityId || CREATURE_TYPES[entity.type]?.watercraft)
            &&
            Math.hypot(entity.position[0] - playerPosition[0], entity.position[2] - playerPosition[2]) <= 56
            && (entity.type !== "glow_sprite" || isNightTime(worldTime))
        )).map((entity) => <Creature key={entity.id} entity={entity} mounted={entity.id === mountedEntityId}/>)}
    </>;
};

export const CommunityPanel = () => {
    const panelId = useStore((state) => state.villagerPanelId);
    const villager = useStore((state) => state.entities.find((entity) => entity.id === panelId));
    const close = useStore((state) => state.closeVillagerPanel);
    const trade = useStore((state) => state.tradeWithVillager);
    const completeTask = useStore((state) => state.completeVillagerTask);
    if (!villager) return null;
    const profession = VILLAGER_PROFESSIONS[villager.profession];
    const itemName = (id) => ITEM_BY_ID[id]?.name ?? id;
    return <div className="community-panel" onMouseDown={(event) => event.stopPropagation()}>
        <button className="community-close" onClick={close} aria-label="Close">×</button>
        <div className="community-eyebrow">{profession?.name ?? "Villager"}</div>
        <h2>{villager.name}</h2>
        <p>“{profession?.dialogue}”</p>
        <div className="community-friendship">Friendship {"♥".repeat(villager.friendLevel)}{"♡".repeat(5 - villager.friendLevel)}</div>
        <section>
            <strong>Community task</strong>
            <span>{villager.task.complete ? "Completed — thank you!" : `Bring ${villager.task.count} ${itemName(villager.task.itemId)} · receive ${villager.task.rewardCount} ${itemName(villager.task.rewardItem)}`}</span>
            <button disabled={villager.task.complete} onClick={completeTask}>{villager.task.complete ? "Completed" : "Help"}</button>
        </section>
        <section>
            <strong>Friendly trade</strong>
            <span>{villager.trade.costCount} {itemName(villager.trade.costItem)} → {villager.trade.rewardCount} {itemName(villager.trade.rewardItem)}</span>
            <button onClick={trade}>Trade</button>
        </section>
    </div>;
};

export const CreatureFeedback = () => {
    const feedback = useStore((state) => state.creatureFeedback);
    return feedback ? <div className="creature-feedback" role="status">♥ {feedback}</div> : null;
};
