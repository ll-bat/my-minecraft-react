import {useAnimations, useGLTF} from "@react-three/drei";
import {useFrame} from "@react-three/fiber";
import {useEffect, useMemo, useRef} from "react";
import {Color, DynamicDrawUsage, MathUtils, Object3D, Vector3} from "three";
import {clone as cloneSkeleton} from "three/examples/jsm/utils/SkeletonUtils";
import {useStore} from "../hooks/useStore";
import birdModel from "../images/assets/gobkit-owl/bird.glb";
import airplaneModel from "../images/assets/3dassets-aircraft/low-wing-single.glb";
import {
    ambientAirplaneRoutes,
    ambientFlyingBirds,
    ambientTreePerches,
    birdMotion,
    isAmbientDaytime
} from "../world/ambientSky";

const SMOKE_PARTICLE_COUNT = 36;
const SMOKE_LIFETIME_SECONDS = 7;

const Bird = ({bird}) => {
    const root = useRef();
    const source = useGLTF(birdModel);
    const scene = useMemo(() => cloneSkeleton(source.scene), [source.scene]);
    const {actions} = useAnimations(source.animations, root);

    useEffect(() => {
        actions.idle?.reset().play();
        actions.attack?.reset().play();
        return () => {
            actions.idle?.stop();
            actions.attack?.stop();
        };
    }, [actions]);

    useFrame(({clock}, delta) => {
        if (!root.current) return;
        const motion = birdMotion(bird, clock.elapsedTime);
        root.current.position.set(...motion.position);
        root.current.rotation.y = MathUtils.lerp(root.current.rotation.y, motion.yaw, Math.min(1, delta * 5));
        root.current.rotation.z = motion.flying ? Math.sin(clock.elapsedTime * 2 + bird.phase * 5) * 0.12 : 0;
        actions.idle?.setEffectiveWeight(motion.flying ? 0 : 1);
        actions.attack?.setEffectiveWeight(motion.flying ? 1 : 0);
        if (!motion.flying) {
            root.current.position.y += Math.sin(clock.elapsedTime * 1.8 + bird.phase * 6) * 0.015;
        }
    });

    return <group ref={root} scale={0.14} raycast={() => null}>
        <primitive object={scene}/>
    </group>;
};

const Airplane = ({playerPosition, route}) => {
    const root = useRef();
    const smoke = useRef();
    const anchor = useRef(new Vector3(...playerPosition));
    const anchorTarget = useRef(new Vector3(...playerPosition));
    const tailPosition = useRef(new Vector3());
    const emissionTime = useRef(0);
    const emissionIndex = useRef(0);
    const particles = useRef(Array.from({length: SMOKE_PARTICLE_COUNT}, () => null));
    const particleTransform = useMemo(() => new Object3D(), []);
    const smokeColor = useMemo(() => new Color(), []);
    const source = useGLTF(airplaneModel);
    const scene = useMemo(() => source.scene.clone(true), [source.scene]);
    const {actions} = useAnimations(source.animations, root);

    useEffect(() => {
        actions["prop-spin"]?.reset().play();
        return () => actions["prop-spin"]?.stop();
    }, [actions]);

    useEffect(() => {
        if (!smoke.current) return;
        smoke.current.instanceMatrix.setUsage(DynamicDrawUsage);
    }, []);

    useFrame(({clock}, delta) => {
        if (!root.current) return;
        anchorTarget.current.set(...playerPosition);
        anchor.current.lerp(anchorTarget.current, Math.min(1, delta * 0.22));
        const angle = clock.elapsedTime * route.speed * route.direction + route.phase * Math.PI * 2;
        root.current.position.set(
            anchor.current.x + Math.sin(angle) * route.radius,
            Math.max(48, anchor.current.y + route.height) + Math.sin(angle * 1.7 + route.wobble) * 2,
            anchor.current.z + Math.cos(angle) * route.radius
        );
        root.current.rotation.set(
            Math.sin(angle * 1.7 + route.wobble) * 0.025,
            route.direction > 0 ? Math.PI - angle : -angle,
            -0.11 * route.direction
        );
        root.current.updateMatrixWorld();

        emissionTime.current += delta;
        if (emissionTime.current >= 0.18) {
            emissionTime.current %= 0.18;
            tailPosition.current.set(0, 0.05, -4.55);
            root.current.localToWorld(tailPosition.current);
            const index = emissionIndex.current % SMOKE_PARTICLE_COUNT;
            const variation = emissionIndex.current + route.phase * 1000;
            particles.current[index] = {
                age: 0,
                position: tailPosition.current.clone().add(new Vector3(
                    Math.sin(variation * 2.17) * 0.06,
                    Math.sin(variation * 1.31) * 0.04,
                    Math.cos(variation * 1.73) * 0.06
                )),
            };
            emissionIndex.current += 1;
        }

        if (!smoke.current) return;
        particles.current.forEach((particle, index) => {
            if (!particle) {
                particleTransform.position.set(0, -1000, 0);
                particleTransform.scale.setScalar(0);
            } else {
                particle.age += delta;
                const life = Math.min(1, particle.age / SMOKE_LIFETIME_SECONDS);
                particle.position.y += delta * (0.04 + life * 0.08);
                particle.position.x += delta * 0.025;
                const particleScale = (0.18 + life * 0.55) * Math.pow(1 - life, 0.45);
                particleTransform.position.copy(particle.position);
                particleTransform.scale.setScalar(particleScale);
                smokeColor.setRGB(
                    0.93 - life * 0.2,
                    0.95 - life * 0.18,
                    0.96 - life * 0.16
                );
                smoke.current.setColorAt(index, smokeColor);
                if (life >= 1) particles.current[index] = null;
            }
            particleTransform.updateMatrix();
            smoke.current.setMatrixAt(index, particleTransform.matrix);
        });
        smoke.current.instanceMatrix.needsUpdate = true;
        if (smoke.current.instanceColor) smoke.current.instanceColor.needsUpdate = true;
    });

    return <>
        <group ref={root} scale={0.28} raycast={() => null}>
            <primitive object={scene}/>
        </group>
        <instancedMesh ref={smoke} args={[null, null, SMOKE_PARTICLE_COUNT]} frustumCulled={false} raycast={() => null}>
            <sphereGeometry args={[0.5, 7, 5]}/>
            <meshStandardMaterial color="#eef2f3" depthWrite={false} opacity={0.3} roughness={1} transparent vertexColors/>
        </instancedMesh>
    </>;
};

export const AmbientSky = () => {
    const seed = useStore((state) => state.seed);
    const playerChunk = useStore((state) => state.playerChunk);
    const playerPosition = useStore((state) => state.playerPosition);
    const dimension = useStore((state) => state.dimension);
    const worldTime = useStore((state) => state.worldTime);
    const creaturesEnabled = useStore((state) => state.gameRules.creatures);
    const birds = useMemo(
        () => [...ambientTreePerches(seed, playerChunk), ...ambientFlyingBirds(seed, playerChunk)],
        [playerChunk, seed]
    );
    const airplanes = useMemo(() => ambientAirplaneRoutes(seed), [seed]);
    const visible = dimension === "overworld" && creaturesEnabled && isAmbientDaytime(worldTime);

    if (!visible) return null;
    return <group>
        {birds.map((bird) => <Bird bird={bird} key={bird.id}/>)}
        {airplanes.map((route) => <Airplane key={route.id} playerPosition={playerPosition} route={route}/>)}
    </group>;
};

useGLTF.preload(birdModel);
useGLTF.preload(airplaneModel);
