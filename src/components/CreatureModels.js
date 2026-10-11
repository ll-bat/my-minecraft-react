import {useAnimations, useGLTF} from "@react-three/drei";
import {useFrame, useLoader} from "@react-three/fiber";
import {useEffect, useMemo, useRef} from "react";
import {AnimationClip, sRGBEncoding, TextureLoader} from "three";
import {FBXLoader} from "three/examples/jsm/loaders/FBXLoader";
import {clone as cloneSkeleton} from "three/examples/jsm/utils/SkeletonUtils";
import horseModel from "../images/game/creatures/horse.glb";
import humanModel from "../images/assets/kenney-animated-characters-retro/human.fbx";
import humanIdleModel from "../images/assets/kenney-animated-characters-retro/human-idle.fbx";
import humanRunModel from "../images/assets/kenney-animated-characters-retro/human-run.fbx";
import humanFemaleSkin from "../images/assets/kenney-animated-characters-retro/Skins/humanFemaleA.png";
import humanMaleSkin from "../images/assets/kenney-animated-characters-retro/Skins/humanMaleA.png";

const Part = ({geometry = "box", position, rotation, scale, color, roughness = 0.86}) => (
    <mesh position={position} rotation={rotation} scale={scale}>
        {geometry === "sphere"
            ? <sphereGeometry args={[0.5, 10, 7]}/>
            : geometry === "cone"
                ? <coneGeometry args={[0.5, 1, 6]}/>
                : <boxGeometry/>}
        <meshStandardMaterial color={color} flatShading roughness={roughness}/>
    </mesh>
);

const SheepLeg = ({x, z, phase, walking}) => {
    const ref = useRef();
    useFrame(({clock}) => {
        if (!ref.current) return;
        ref.current.rotation.x = walking ? Math.sin(clock.elapsedTime * 7 + phase) * 0.38 : 0;
    });
    return <group ref={ref} position={[x, 0.265, z]}>
        <Part position={[0, -0.2, 0]} scale={[0.14, 0.48, 0.15]} color="#8a7968"/>
        <Part position={[0, -0.46, 0.015]} scale={[0.17, 0.16, 0.22]} color="#403832"/>
    </group>;
};

export const SheepModel = ({walking}) => (
    <group>
        <Part geometry="sphere" position={[0, 0.48, -0.02]} scale={[1.28, 1.0, 1.62]} color="#f1eee6" roughness={1}/>
        <Part geometry="sphere" position={[0, 0.54, 0.78]} scale={[0.62, 0.62, 0.7]} color="#6f655d"/>
        <Part geometry="sphere" position={[0, 0.48, 1.03]} scale={[0.43, 0.38, 0.38]} color="#8d7d70"/>
        <Part position={[-0.36, 0.67, 0.76]} rotation={[0, 0, -0.35]} scale={[0.34, 0.1, 0.22]} color="#827267"/>
        <Part position={[0.36, 0.67, 0.76]} rotation={[0, 0, 0.35]} scale={[0.34, 0.1, 0.22]} color="#827267"/>
        <Part geometry="sphere" position={[-0.18, 0.67, 1.12]} scale={[0.09, 0.09, 0.07]} color="#171a1b" roughness={0.25}/>
        <Part geometry="sphere" position={[0.18, 0.67, 1.12]} scale={[0.09, 0.09, 0.07]} color="#171a1b" roughness={0.25}/>
        <Part geometry="sphere" position={[0, 0.43, 1.22]} scale={[0.16, 0.1, 0.08]} color="#3d3431"/>
        <Part geometry="sphere" position={[0, 0.57, -0.9]} scale={[0.28, 0.3, 0.34]} color="#eeeae1"/>
        <SheepLeg x={-0.42} z={-0.47} phase={0} walking={walking}/>
        <SheepLeg x={0.42} z={-0.47} phase={Math.PI} walking={walking}/>
        <SheepLeg x={-0.42} z={0.46} phase={Math.PI} walking={walking}/>
        <SheepLeg x={0.42} z={0.46} phase={0} walking={walking}/>
    </group>
);

export const HorseModel = ({walking}) => {
    const root = useRef();
    const source = useGLTF(horseModel);
    const scene = useMemo(() => source.scene.clone(true), [source.scene]);
    const {actions} = useAnimations(source.animations, root);
    useEffect(() => {
        const action = walking ? actions.walk : null;
        action?.reset().fadeIn(0.18).play();
        return () => action?.fadeOut(0.18);
    }, [actions, walking]);
    return <group ref={root} position={[0, -0.4, 0]} rotation={[0, Math.PI / 2, 0]} scale={2.05}>
        <primitive object={scene}/>
    </group>;
};

function humanVariant(id) {
    return Array.from(id ?? "human").reduce((total, character) => total + character.charCodeAt(0), 0) % 2;
}

function namedClip(source, name) {
    const sourceClip = source.animations.find((clip) => clip.name.toLowerCase().includes(name))
        ?? source.animations[0];
    const clip = sourceClip?.clone() ?? new AnimationClip(name, 1, []);
    clip.name = name;
    return clip;
}

export const HumanModel = ({entity, walking}) => {
    const root = useRef();
    const modelSource = useLoader(FBXLoader, humanModel);
    const idleSource = useLoader(FBXLoader, humanIdleModel);
    const runSource = useLoader(FBXLoader, humanRunModel);
    const female = humanVariant(entity.id) === 0;
    const skin = useLoader(TextureLoader, female ? humanFemaleSkin : humanMaleSkin);
    skin.encoding = sRGBEncoding;
    const scene = useMemo(() => {
        const clone = cloneSkeleton(modelSource);
        clone.traverse((object) => {
            if (!object.isMesh) return;
            const applySkin = (material) => {
                const next = material.clone();
                next.map = skin;
                next.color.set("white");
                next.needsUpdate = true;
                return next;
            };
            object.material = Array.isArray(object.material)
                ? object.material.map(applySkin)
                : applySkin(object.material);
        });
        return clone;
    }, [modelSource, skin]);
    const clips = useMemo(() => [namedClip(idleSource, "idle"), namedClip(runSource, "walk")], [idleSource, runSource]);
    const {actions} = useAnimations(clips, root);
    useEffect(() => {
        const action = walking ? actions.walk : actions.idle;
        action?.reset().fadeIn(0.2).play();
        return () => action?.fadeOut(0.2);
    }, [actions, walking]);
    return <group ref={root} position={[0, -0.4, 0]} rotation={[0, Math.PI, 0]} scale={0.0045}>
        <primitive object={scene}/>
    </group>;
};

useGLTF.preload(horseModel);
