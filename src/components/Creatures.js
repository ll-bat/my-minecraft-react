import {useFrame} from "@react-three/fiber";
import {useEffect, useRef} from "react";
import {useStore} from "../hooks/useStore";
import {isNightTime} from "../world/entities";

const Box = ({position, scale, color, emissive}) => (
    <mesh position={position} scale={scale}>
        <boxGeometry/>
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={emissive ? 0.75 : 0}/>
    </mesh>
);

const CreatureModel = ({entity}) => {
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

const Creature = ({entity}) => {
    const ref = useRef();
    const interactCreature = useStore((state) => state.interactCreature);
    useFrame(({clock}) => {
        if (!ref.current) return;
        const bob = entity.animationState === "walking" ? Math.abs(Math.sin(clock.elapsedTime * 7)) * 0.08 : 0;
        const happy = entity.animationState === "happy" ? Math.sin(clock.elapsedTime * 8) * 0.08 : 0;
        ref.current.position.set(entity.position[0], entity.position[1] + bob + happy, entity.position[2]);
        ref.current.rotation.y = entity.heading;
    });
    return (
        <group
            ref={ref}
            position={entity.position}
            onPointerDown={(event) => {
                event.stopPropagation();
                if (event.distance <= 6) interactCreature(entity.id);
            }}
        >
            <CreatureModel entity={entity}/>
            {entity.animationState === "happy" && (
                <Box position={[0, 1.65, 0]} scale={[0.18, 0.18, 0.18]} color="#ff5277" emissive="#ff315d"/>
            )}
        </group>
    );
};

export const Creatures = () => {
    const entities = useStore((state) => state.entities);
    const playerPosition = useStore((state) => state.playerPosition);
    const worldTime = useStore((state) => state.worldTime);
    const feedback = useStore((state) => state.creatureFeedback);
    const clearFeedback = useStore((state) => state.clearCreatureFeedback);
    useEffect(() => {
        if (!feedback) return undefined;
        const timer = window.setTimeout(clearFeedback, 3500);
        return () => window.clearTimeout(timer);
    }, [clearFeedback, feedback]);

    return <>
        {entities.filter((entity) => (
            Math.hypot(entity.position[0] - playerPosition[0], entity.position[2] - playerPosition[2]) <= 56
            && (entity.type !== "glow_sprite" || isNightTime(worldTime))
        )).map((entity) => <Creature key={entity.id} entity={entity}/>)}
    </>;
};

export const CreatureFeedback = () => {
    const feedback = useStore((state) => state.creatureFeedback);
    return feedback ? <div className="creature-feedback" role="status">♥ {feedback}</div> : null;
};
