import {Sky, useTexture} from "@react-three/drei";
import {useFrame} from "@react-three/fiber";
import {useEffect, useMemo, useRef, useState} from "react";
import {AdditiveBlending, BackSide, Color, sRGBEncoding} from "three";
import {useStore} from "../hooks/useStore";
import {BIOMES, biomeAt} from "../world/terrain";
import {
    automaticWeatherDelay,
    DAY_DURATION_SECONDS,
    dayPeriodForWorldTime,
    nextAutomaticWeather,
    normalizeWeather,
    WEATHER_TRANSITION_SECONDS,
    WEATHER_PROFILES,
} from "../world/sky";
import sunTextureUrl from "../images/assets/sky/sun-nasa.png";
import moonTextureUrl from "../images/assets/sky/moon-nasa.jpg";
import starTextureUrl from "../images/assets/sky/stars-nasa.jpg";
import cloudTextureUrl from "../images/assets/sky/cloud-layer-polyhaven.png";

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

const WeatherParticles = ({playerPosition, type}) => {
    const points = useRef();
    const positions = useMemo(() => {
        const count = type === "rain" ? 620 : type === "snow" ? 420 : 180;
        const values = new Float32Array(count * 3);
        for (let index = 0; index < count; index += 1) {
            values[index * 3] = (particleValue(index, 1) - 0.5) * 38;
            values[index * 3 + 1] = particleValue(index, 2) * 24 - 8;
            values[index * 3 + 2] = (particleValue(index, 3) - 0.5) * 38;
        }
        return values;
    }, [type]);

    useFrame((_, delta) => {
        if (!points.current) return;
        const attribute = points.current.geometry.attributes.position;
        const animationTime = performance.now() * 0.001;
        for (let index = 0; index < attribute.count; index += 1) {
            if (type === "rain") {
                attribute.array[index * 3 + 1] -= 16 * delta;
                attribute.array[index * 3] += 2.4 * delta;
                if (attribute.array[index * 3 + 1] < -8) {
                    attribute.array[index * 3 + 1] = 16;
                    attribute.array[index * 3] = (particleValue(index, animationTime) - 0.5) * 38;
                }
            } else if (type === "snow") {
                attribute.array[index * 3 + 1] -= 2.2 * delta;
                attribute.array[index * 3] += Math.sin(index * 2.1 + animationTime * 2) * delta * 0.35;
                if (attribute.array[index * 3 + 1] < -8) attribute.array[index * 3 + 1] = 16;
            } else {
                attribute.array[index * 3] += 9 * delta;
                attribute.array[index * 3 + 1] += Math.sin(index * 2.1 + animationTime * 4) * delta * 0.22;
                if (attribute.array[index * 3] > 19) attribute.array[index * 3] = -19;
            }
        }
        attribute.needsUpdate = true;
        points.current.position.set(playerPosition[0], playerPosition[1] + 8, playerPosition[2]);
    });

    if (!type) return null;
    return (
        <points ref={points} frustumCulled={false} raycast={() => null}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]}/>
            </bufferGeometry>
            <pointsMaterial
                color={type === "rain" ? "#b9dff0" : type === "snow" ? "#ffffff" : "#e8dfc2"}
                opacity={type === "rain" ? 0.7 : type === "snow" ? 0.85 : 0.45}
                size={type === "rain" ? 0.075 : type === "snow" ? 0.13 : 0.055}
                transparent
                depthWrite={false}
            />
        </points>
    );
};

const CelestialSky = ({playerPosition, sunPosition, moonPosition, nightOpacity, cloudOpacity, cloudSpeed, rainy}) => {
    const [sunTexture, moonTexture, starTexture, cloudTexture] = useTexture([
        sunTextureUrl,
        moonTextureUrl,
        starTextureUrl,
        cloudTextureUrl,
    ]);
    const cloud = useRef();

    useEffect(() => {
        [sunTexture, moonTexture, starTexture, cloudTexture].forEach((texture) => {
            texture.encoding = sRGBEncoding;
            texture.needsUpdate = true;
        });
    }, [cloudTexture, moonTexture, starTexture, sunTexture]);

    useFrame((_, delta) => {
        if (cloud.current) cloud.current.rotation.y += delta * cloudSpeed;
    });

    return (
        <group position={[playerPosition[0], playerPosition[1] - 14, playerPosition[2]]} raycast={() => null}>
            <mesh frustumCulled={false} renderOrder={-4}>
                <sphereGeometry args={[330, 40, 20]}/>
                <meshBasicMaterial map={starTexture} side={BackSide} transparent opacity={nightOpacity} depthWrite={false}/>
            </mesh>
            <sprite position={sunPosition} scale={[34, 34, 1]} renderOrder={-2}>
                <spriteMaterial
                    map={sunTexture}
                    transparent
                    opacity={Math.max(0, 1 - nightOpacity * 1.4) * (1 - cloudOpacity * 0.72)}
                    depthWrite={false}
                    blending={AdditiveBlending}
                />
            </sprite>
            <mesh position={moonPosition} scale={12} renderOrder={-2}>
                <sphereGeometry args={[1, 32, 20]}/>
                <meshBasicMaterial map={moonTexture} transparent opacity={nightOpacity * (1 - cloudOpacity * 0.86)} depthWrite={false}/>
            </mesh>
            {cloudOpacity > 0.01 && (
                <mesh ref={cloud} frustumCulled={false} rotation={[0, 0.35, 0]} renderOrder={-1}>
                    <sphereGeometry args={[255, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2]}/>
                    <meshBasicMaterial
                        color={rainy ? "#727d88" : nightOpacity > 0.2 ? "#7f8796" : "#eef2f1"}
                        map={cloudTexture}
                        side={BackSide}
                        transparent
                        opacity={cloudOpacity}
                        depthWrite={false}
                    />
                </mesh>
            )}
        </group>
    );
};

export const WorldEnvironment = () => {
    const seed = useStore((state) => state.seed);
    const playerPosition = useStore((state) => state.playerPosition);
    const setWorldTime = useStore((state) => state.setWorldTime);
    const dimension = useStore((state) => state.dimension);
    const gameRules = useStore((state) => state.gameRules);
    const worldTime = useStore((state) => state.worldTime);
    const skyWeather = useStore((state) => state.skyWeather);
    const skyWeatherTransitionSeconds = useStore((state) => state.skyWeatherTransitionSeconds ?? 2);
    const setSkyWeather = useStore((state) => state.setSkyWeather);
    const [elapsed, setElapsed] = useState(worldTime);
    const initialWeather = normalizeWeather(skyWeather);
    const [weatherTransition, setWeatherTransition] = useState({from: initialWeather, to: initialWeather, mix: 1});
    const elapsedRef = useRef(worldTime);
    const lastUpdate = useRef(worldTime);
    const weatherTimer = useRef(0);
    const weatherDuration = useRef(automaticWeatherDelay());
    const weatherMix = useRef(1);
    const weatherTransitionDuration = useRef(2);
    const weatherVisualUpdate = useRef(0);
    const previousWeather = useRef(initialWeather);

    useEffect(() => {
        if (Math.abs(worldTime - elapsedRef.current) > 0.5) {
            elapsedRef.current = worldTime;
            lastUpdate.current = worldTime;
            setElapsed(worldTime);
        }
    }, [worldTime]);

    useEffect(() => {
        const nextWeather = normalizeWeather(skyWeather);
        weatherTimer.current = 0;
        weatherDuration.current = automaticWeatherDelay();
        if (nextWeather === previousWeather.current) return;
        weatherTransitionDuration.current = skyWeatherTransitionSeconds;
        setWeatherTransition({from: previousWeather.current, to: nextWeather, mix: 0});
        previousWeather.current = nextWeather;
        weatherMix.current = 0;
        weatherVisualUpdate.current = 0;
    }, [skyWeather, skyWeatherTransitionSeconds]);

    useFrame((_, delta) => {
        if (gameRules.dayCycle) {
            elapsedRef.current += delta;
            if (elapsedRef.current - lastUpdate.current >= 0.5) {
                lastUpdate.current = elapsedRef.current;
                setElapsed(elapsedRef.current);
                setWorldTime(elapsedRef.current);
            }
        }
        if (gameRules.weather) {
            weatherTimer.current += delta;
            if (weatherTimer.current >= weatherDuration.current) {
                weatherTimer.current = 0;
                setSkyWeather(nextAutomaticWeather(previousWeather.current), WEATHER_TRANSITION_SECONDS);
            }
        }
        if (weatherMix.current < 1) {
            const duration = Math.max(0.01, weatherTransitionDuration.current);
            weatherMix.current = Math.min(1, weatherMix.current + delta / duration);
            weatherVisualUpdate.current += delta;
            if (weatherVisualUpdate.current >= 0.2 || weatherMix.current === 1) {
                weatherVisualUpdate.current = 0;
                setWeatherTransition((current) => ({...current, mix: weatherMix.current}));
            }
        }
    });

    const biome = biomeAt(seed, playerPosition[0], playerPosition[2]);
    const environment = dimension === "dream_grove"
        ? {color: "#8b6bc5", fog: "#725da0", rayleigh: 1.2}
        : BIOME_SKY[biome];
    const fluidAtCamera = useStore.getState().getBlock(playerPosition.map(Math.round));
    const timeOfDay = (elapsed / DAY_DURATION_SECONDS + 0.25) % 1;
    const sunAngle = timeOfDay * Math.PI * 2;
    const sunHeight = Math.sin(sunAngle);
    const daylight = Math.max(0.055, Math.min(1, (sunHeight + 0.12) / 1.12));
    const nightOpacity = Math.max(0, Math.min(1, -sunHeight * 1.4));
    const period = dayPeriodForWorldTime(elapsed);
    const dusk = period === "morning" || period === "evening";
    const weather = gameRules.weather ? weatherTransition.to : "sunny";
    const fromProfile = gameRules.weather ? WEATHER_PROFILES[weatherTransition.from] : WEATHER_PROFILES.sunny;
    const toProfile = WEATHER_PROFILES[weather];
    const weatherMixValue = gameRules.weather ? weatherTransition.mix : 1;
    const profile = {
        cloudOpacity: fromProfile.cloudOpacity + (toProfile.cloudOpacity - fromProfile.cloudOpacity) * weatherMixValue,
        haze: fromProfile.haze + (toProfile.haze - fromProfile.haze) * weatherMixValue,
        wind: fromProfile.wind + (toProfile.wind - fromProfile.wind) * weatherMixValue,
        precipitation: weatherMixValue < 0.5 ? fromProfile.precipitation : toProfile.precipitation,
    };
    const effectiveCloudOpacity = profile.cloudOpacity;
    const baseSky = new Color(environment.color);
    if (dusk) baseSky.lerp(new Color(period === "morning" ? "#f4b782" : "#e58b72"), 0.3);
    const skyColor = baseSky.lerp(new Color("#030617"), 1 - daylight).lerp(new Color("#687680"), profile.haze).getStyle();
    const fogColor = new Color(environment.fog).lerp(new Color("#090c1c"), 1 - daylight)
        .lerp(new Color("#69747b"), profile.haze).getStyle();
    const submerged = fluidAtCamera === "water" || fluidAtCamera === "lava";
    const activeBackground = fluidAtCamera === "water" ? "#174f79"
        : fluidAtCamera === "lava" ? "#8f2f08" : skyColor;
    const activeFog = fluidAtCamera === "water" ? "#1e638c"
        : fluidAtCamera === "lava" ? "#a83a0b" : fogColor;
    const sunPosition = [Math.cos(sunAngle) * 190, sunHeight * 190, -58];
    const moonPosition = sunPosition.map((value) => -value);

    return (
        <>
            <color attach="background" args={[activeBackground]}/>
            <fog attach="fog" args={[activeFog, submerged ? 1 : 24, submerged ? 18 : ["rain", "snow"].includes(weather) ? 72 : 110]}/>
            {!submerged && (
                <>
                    <Sky
                        distance={450000}
                        rayleigh={environment.rayleigh + profile.haze * 1.4}
                        turbidity={weather === "sunny" ? 4 : 9}
                        sunPosition={sunPosition}
                    />
                    <CelestialSky
                        playerPosition={playerPosition}
                        sunPosition={sunPosition}
                        moonPosition={moonPosition}
                        nightOpacity={nightOpacity * (1 - effectiveCloudOpacity * 0.88)}
                        cloudOpacity={effectiveCloudOpacity}
                        cloudSpeed={profile.wind}
                        rainy={(weatherTransition.from === "rain" && weatherMixValue < 0.6)
                            || (weather === "rain" && weatherMixValue > 0.4)}
                    />
                </>
            )}
            <ambientLight intensity={submerged ? 0.28 : 0.1 + daylight * 0.5 * (1 - profile.haze * 0.45)}/>
            <directionalLight
                color={dusk ? "#ffd0a0" : daylight > 0.25 ? "#fff4dc" : "#7c8cc4"}
                intensity={submerged ? 0.1 : daylight * 0.9 * (1 - profile.haze * 0.5)}
                position={sunPosition}
            />
            {!submerged && <WeatherParticles playerPosition={playerPosition} type={profile.precipitation}/>}
        </>
    );
};
