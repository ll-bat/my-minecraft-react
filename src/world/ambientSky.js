import {CHUNK_SIZE} from "./chunks";
import {randomAt, seedToNumber} from "./noise";
import {BIOMES, hasNaturalWater, terrainAt} from "./terrain";

export const MAX_PERCHED_BIRDS = 6;
export const AMBIENT_FLYING_BIRDS = 8;
export const MAX_AMBIENT_BIRDS = MAX_PERCHED_BIRDS + AMBIENT_FLYING_BIRDS;
export const AMBIENT_AIRPLANES = 4;

function treeAt(seed, numericSeed, x, z) {
    const treeRoll = randomAt(numericSeed + 12007, x, 0, z);
    if (treeRoll <= 0.95) return null;
    const {biome, surface} = terrainAt(seed, x, z);
    if (biome !== BIOMES.FOREST || hasNaturalWater(seed, x, z, surface)) return null;
    const threshold = surface >= 24 ? 0.95 : 0.972;
    if (treeRoll <= threshold) return null;
    const trunkHeight = 4 + Math.floor(randomAt(numericSeed + 13001, x, 0, z) * 3);
    return [x, surface + trunkHeight + 2.5, z];
}

export function ambientTreePerches(seed, playerChunk, maximum = MAX_PERCHED_BIRDS) {
    const numericSeed = seedToNumber(seed);
    const regionX = Math.floor(playerChunk[0] / 3);
    const regionZ = Math.floor(playerChunk[1] / 3);
    const centerX = regionX * CHUNK_SIZE * 3 + CHUNK_SIZE * 1.5;
    const centerZ = regionZ * CHUNK_SIZE * 3 + CHUNK_SIZE * 1.5;
    const candidates = [];

    for (let dx = -30; dx <= 30; dx += 1) {
        for (let dz = -30; dz <= 30; dz += 1) {
            const x = Math.round(centerX + dx);
            const z = Math.round(centerZ + dz);
            const perch = treeAt(seed, numericSeed, x, z);
            if (!perch) continue;
            candidates.push({
                position: perch,
                rank: randomAt(numericSeed + 31013, x, 0, z),
            });
        }
    }

    candidates.sort((left, right) => right.rank - left.rank);
    const selected = [];
    for (const candidate of candidates) {
        if (selected.every(({position}) => Math.hypot(
            candidate.position[0] - position[0],
            candidate.position[2] - position[2]
        ) >= 7)) {
            selected.push(candidate);
        }
        if (selected.length >= maximum) break;
    }

    return selected.map(({position}, index) => ({
        id: `${regionX}:${regionZ}:${position.join(":")}`,
        position,
        phase: randomAt(numericSeed + 32003, regionX, index, regionZ),
        radius: 5 + randomAt(numericSeed + 33013, regionX, index, regionZ) * 4,
        cycleSeconds: 28 + randomAt(numericSeed + 34019, regionX, index, regionZ) * 10,
    }));
}

export function ambientFlyingBirds(seed, playerChunk, maximum = AMBIENT_FLYING_BIRDS) {
    const numericSeed = seedToNumber(`${seed}:flying-birds`);
    const regionX = Math.floor(playerChunk[0] / 3);
    const regionZ = Math.floor(playerChunk[1] / 3);
    const centerX = regionX * CHUNK_SIZE * 3 + CHUNK_SIZE * 1.5;
    const centerZ = regionZ * CHUNK_SIZE * 3 + CHUNK_SIZE * 1.5;

    return Array.from({length: maximum}, (_, index) => {
        const angle = (index + randomAt(numericSeed + 41011, regionX, index, regionZ) * 0.45)
            * Math.PI * 2 / maximum;
        const distance = 13 + randomAt(numericSeed + 42013, regionX, index, regionZ) * 23;
        const x = Math.round(centerX + Math.sin(angle) * distance);
        const z = Math.round(centerZ + Math.cos(angle) * distance);
        const {surface} = terrainAt(seed, x, z);
        return {
            id: `flying:${regionX}:${regionZ}:${index}`,
            position: [x, surface + 12 + randomAt(numericSeed + 43019, regionX, index, regionZ) * 10, z],
            phase: randomAt(numericSeed + 44017, regionX, index, regionZ),
            radius: 7 + randomAt(numericSeed + 45007, regionX, index, regionZ) * 7,
            cycleSeconds: 18 + randomAt(numericSeed + 46021, regionX, index, regionZ) * 14,
            alwaysFlying: true,
        };
    });
}

export function ambientAirplaneRoutes(seed, maximum = AMBIENT_AIRPLANES) {
    const numericSeed = seedToNumber(`${seed}:airplanes`);
    return Array.from({length: maximum}, (_, index) => ({
        id: `airplane:${index}`,
        phase: randomAt(numericSeed + 51001, index, 0, 0),
        radius: 58 + randomAt(numericSeed + 52009, index, 0, 0) * 34,
        height: 30 + randomAt(numericSeed + 53003, index, 0, 0) * 18,
        speed: 0.032 + randomAt(numericSeed + 54001, index, 0, 0) * 0.022,
        direction: randomAt(numericSeed + 55009, index, 0, 0) < 0.5 ? -1 : 1,
        wobble: randomAt(numericSeed + 56003, index, 0, 0) * Math.PI * 2,
    }));
}

export function birdMotion(bird, elapsed) {
    if (bird.alwaysFlying) {
        const angle = elapsed / bird.cycleSeconds * Math.PI * 2 + bird.phase * Math.PI * 2;
        const nextAngle = angle + 0.01;
        const x = Math.sin(angle) * bird.radius;
        const z = Math.cos(angle) * bird.radius * 0.72;
        const nextX = Math.sin(nextAngle) * bird.radius;
        const nextZ = Math.cos(nextAngle) * bird.radius * 0.72;
        return {
            flying: true,
            position: [
                bird.position[0] + x,
                bird.position[1] + Math.sin(angle * 2) * 1.1,
                bird.position[2] + z,
            ],
            yaw: Math.atan2(nextX - x, nextZ - z),
        };
    }
    const cycle = (elapsed / bird.cycleSeconds + bird.phase) % 1;
    const flightStart = 0.36;
    if (cycle < flightStart) {
        return {flying: false, position: bird.position, yaw: bird.phase * Math.PI * 2};
    }

    const progress = (cycle - flightStart) / (1 - flightStart);
    const envelope = Math.sin(progress * Math.PI);
    const angle = progress * Math.PI * 2;
    const nextAngle = angle + 0.01;
    const x = Math.sin(angle) * bird.radius * envelope;
    const z = (1 - Math.cos(angle)) * bird.radius * 0.7 * envelope;
    const nextX = Math.sin(nextAngle) * bird.radius * Math.sin(Math.min(1, progress + 0.0016) * Math.PI);
    const nextZ = (1 - Math.cos(nextAngle)) * bird.radius * 0.7
        * Math.sin(Math.min(1, progress + 0.0016) * Math.PI);
    return {
        flying: true,
        position: [
            bird.position[0] + x,
            bird.position[1] + envelope * (5 + bird.radius * 0.25 + Math.sin(angle * 2) * 0.35),
            bird.position[2] + z,
        ],
        yaw: Math.atan2(nextX - x, nextZ - z),
    };
}

export function isAmbientDaytime(worldTime) {
    const timeOfDay = (worldTime / 360 + 0.25) % 1;
    return Math.sin(timeOfDay * Math.PI * 2) > 0.03;
}
