import {CHUNK_SIZE} from "./chunks";
import {randomAt, seedToNumber} from "./noise";
import {BIOMES, terrainAt} from "./terrain";

export const MAX_AMBIENT_BIRDS = 5;
export const AMBIENT_AIRPLANES = 1;

function treeAt(seed, numericSeed, x, z) {
    const treeRoll = randomAt(numericSeed + 12007, x, 0, z);
    if (treeRoll <= 0.95) return null;
    const {biome, surface} = terrainAt(seed, x, z);
    if (biome !== BIOMES.FOREST) return null;
    const threshold = surface >= 24 ? 0.95 : 0.972;
    if (treeRoll <= threshold) return null;
    const trunkHeight = 4 + Math.floor(randomAt(numericSeed + 13001, x, 0, z) * 3);
    return [x, surface + trunkHeight + 2.5, z];
}

export function ambientTreePerches(seed, playerChunk, maximum = MAX_AMBIENT_BIRDS) {
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

export function birdMotion(bird, elapsed) {
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
