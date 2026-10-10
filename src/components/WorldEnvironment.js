import {Sky} from "@react-three/drei";
import {useFrame} from "@react-three/fiber";
import {useEffect, useMemo, useRef, useState} from "react";
import {Color} from "three";
import {useStore} from "../hooks/useStore";
import {randomAt, seedToNumber} from "../world/noise";
import {BIOMES, biomeAt} from "../world/terrain";

const DAY_DURATION_SECONDS = 360;

const BIOME_SKY = {
    [BIOMES.PLAINS]: {color: "#9ed9ef", fog: "#b8dce8", rayleigh: 0.55},
    [BIOMES.FOREST]: {color: "#8fc9df", fog: "#9fc4b5", rayleigh: 0.7},
    [BIOMES.DESERT]: {color: "#e7cf9b", fog: "#dcc99e", rayleigh: 0.35},
    [BIOMES.MOUNTAINS]: {color: "#91b9d1", fog: "#b7c4ca", rayleigh: 0.9},
};

function particleValue(index, salt) {
    const value = Math.sin(index * 91.17 + salt * 17.31) * 43758.5453;
    return value - Math.floor(value);
}

const Weather = ({playerPosition, type}) => {
    const points = useRef();
    const positions = useMemo(() => {
        const values = new Float32Array(360 * 3);
        for (let index = 0; index < 360; index += 1) {
            values[index * 3] = (particleValue(index, 1) - 0.5) * 34;
            values[index * 3 + 1] = particleValue(index, 2) * 22 - 8;
            values[index * 3 + 2] = (particleValue(index, 3) - 0.5) * 34;
        }
        return values;
    }, []);

    useFrame((_, delta) => {
        if (!points.current || type === "clear") {
            return;
        }
        const attribute = points.current.geometry.attributes.position;
        const fallSpeed = type === "snow" ? 2.2 : 14;
        for (let index = 0; index < attribute.count; index += 1) {
            attribute.array[index * 3 + 1] -= fallSpeed * delta;
            if (attribute.array[index * 3 + 1] < -8) {
                attribute.array[index * 3 + 1] = 14;
            }
            if (type === "snow") {
                attribute.array[index * 3] += Math.sin(index + performance.now() * 0.001) * delta * 0.25;
            }
        }
        attribute.needsUpdate = true;
        points.current.position.set(playerPosition[0], playerPosition[1] + 8, playerPosition[2]);
    });

    if (type === "clear") {
        return null;
    }

    return (
        <points ref={points} frustumCulled={false}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            </bufferGeometry>
            <pointsMaterial
                color={type === "snow" ? "#ffffff" : "#a9d8ed"}
                opacity={type === "snow" ? 0.85 : 0.65}
                size={type === "snow" ? 0.13 : 0.07}
                transparent
            />
        </points>
    );
};

export const WorldEnvironment = () => {
    const seed = useStore((state) => state.seed);
    const playerPosition = useStore((state) => state.playerPosition);
    const setWorldTime = useStore((state) => state.setWorldTime);
    const dimension = useStore((state) => state.dimension);
    const gameRules = useStore((state) => state.gameRules);
    const worldTime = useStore((state) => state.worldTime);
    const [elapsed, setElapsed] = useState(worldTime);
    const elapsedRef = useRef(worldTime);
    const lastUpdate = useRef(0);

    useEffect(() => {
        if (Math.abs(worldTime - elapsedRef.current) > 2) {
            elapsedRef.current = worldTime;
            setElapsed(worldTime);
        }
    }, [worldTime]);

    useFrame((_, delta) => {
        if (!gameRules.dayCycle) return;
        elapsedRef.current += delta;
        if (elapsedRef.current - lastUpdate.current >= 0.5) {
            lastUpdate.current = elapsedRef.current;
            setElapsed(elapsedRef.current);
            setWorldTime(elapsedRef.current);
        }
    });

    const biome = biomeAt(seed, playerPosition[0], playerPosition[2]);
    const environment = dimension === "dream_grove"
        ? {color: "#8b6bc5", fog: "#725da0", rayleigh: 1.2}
        : BIOME_SKY[biome];
    const fluidAtCamera = useStore.getState().getBlock(playerPosition.map(Math.round));
    const timeOfDay = (elapsed / DAY_DURATION_SECONDS + 0.25) % 1;
    const sunAngle = timeOfDay * Math.PI * 2;
    const daylight = Math.max(0.08, Math.sin(sunAngle) * 0.92);
    const nightMix = 1 - daylight;
    const skyColor = new Color(environment.color).lerp(new Color("#050817"), nightMix).getStyle();
    const fogColor = new Color(environment.fog).lerp(new Color("#090c1c"), nightMix).getStyle();
    const weatherPeriod = Math.floor(elapsed / 45);
    const raining = randomAt(seedToNumber(seed) + 17011, weatherPeriod) > 0.55;
    const weatherType = !gameRules.weather || dimension === "dream_grove" || !raining || biome === BIOMES.DESERT
        ? "clear"
        : biome === BIOMES.MOUNTAINS ? "snow" : "rain";
    const submerged = fluidAtCamera === "water" || fluidAtCamera === "lava";
    const activeBackground = fluidAtCamera === "water"
        ? "#174f79"
        : fluidAtCamera === "lava" ? "#8f2f08" : skyColor;
    const activeFog = fluidAtCamera === "water"
        ? "#1e638c"
        : fluidAtCamera === "lava" ? "#a83a0b" : fogColor;

    return (
        <>
            <color attach="background" args={[activeBackground]} />
            <fog attach="fog" args={[activeFog, submerged ? 1 : 24, submerged ? 18 : 95]} />
            {!submerged && (
                <Sky
                    distance={450000}
                    rayleigh={environment.rayleigh}
                    sunPosition={[Math.cos(sunAngle) * 100, Math.sin(sunAngle) * 100, 35]}
                />
            )}
            <ambientLight intensity={submerged ? 0.28 : 0.1 + daylight * 0.5} />
            <directionalLight
                color={daylight > 0.25 ? "#fff4dc" : "#7c8cc4"}
                intensity={submerged ? 0.1 : daylight * 0.85}
                position={[Math.cos(sunAngle) * 80, Math.sin(sunAngle) * 80, 30]}
            />
            {!submerged && <Weather playerPosition={playerPosition} type={weatherType} />}
        </>
    );
};
