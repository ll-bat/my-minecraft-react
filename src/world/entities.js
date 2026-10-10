import {chunkCoordinate, getBlock} from "./chunks";
import {randomAt, seedToNumber} from "./noise";
import {BIOMES, biomeAt, hasLakeWater, surfaceHeight} from "./terrain";
import {BLOCK_BY_ID} from "./blocks";

export const CREATURE_TYPES = {
    sheep: {name: "Sheep", maxHealth: 10, color: "#eee9df", gift: "flower", groundOffset: 0.775},
    rabbit: {name: "Rabbit", maxHealth: 8, color: "#b88455", gift: "stick", groundOffset: 0.425},
    glow_sprite: {name: "Glow Sprite", maxHealth: 12, color: "#ffe66d", gift: "coal", groundOffset: 0.275},
};

export const CREATURE_UPDATE_DISTANCE = 48;
export const CREATURE_INTERACTION_COOLDOWN = 800;
export const CREATURE_GIFT_COOLDOWN = 30000;

export function creatureGroundY(type, surface) {
    return surface + (CREATURE_TYPES[type]?.groundOffset ?? 0.5);
}

function terrainSurfaceAt(seed, x, z) {
    return surfaceHeight(seed, Math.round(x), Math.round(z));
}

export function isNightTime(elapsedSeconds) {
    const timeOfDay = (elapsedSeconds / 360 + 0.25) % 1;
    return Math.sin(timeOfDay * Math.PI * 2) < 0.08;
}

function creatureTypeForBiome(biome, night) {
    if (night) return "glow_sprite";
    return biome === BIOMES.DESERT || biome === BIOMES.MOUNTAINS ? "rabbit" : "sheep";
}

export function spawnCreaturesForColumn(seed, chunkX, chunkZ, playerPosition, night = false) {
    const numericSeed = seedToNumber(seed) + (night ? 31013 : 29009);
    const group = night ? "night" : "day";
    const count = randomAt(numericSeed, chunkX, 0, chunkZ) > (night ? 0.56 : 0.38) ? (night ? 1 : 2) : 0;
    const entities = [];
    for (let index = 0; index < count; index += 1) {
        const x = chunkX * 16 + 2 + Math.floor(randomAt(numericSeed + 101, chunkX, index, chunkZ) * 12);
        const z = chunkZ * 16 + 2 + Math.floor(randomAt(numericSeed + 211, chunkX, index, chunkZ) * 12);
        const surface = surfaceHeight(seed, x, z);
        if (hasLakeWater(seed, x, z, surface) || Math.hypot(x - playerPosition[0], z - playerPosition[2]) < 9) continue;
        const type = creatureTypeForBiome(biomeAt(seed, x, z), night);
        entities.push({
            id: `${type}:${chunkX},${chunkZ}:${index}:${group}`,
            type,
            position: [x, creatureGroundY(type, surface), z],
            velocity: [0, 0, 0],
            health: CREATURE_TYPES[type].maxHealth,
            animationState: "idle",
            heading: randomAt(numericSeed + 307, chunkX, index, chunkZ) * Math.PI * 2,
            friendLevel: 0,
            followUntil: 0,
            lastInteraction: 0,
            lastGift: 0,
            persistent: false,
            chunk: [chunkX, chunkZ],
        });
    }
    return entities;
}

function blocked(state, entity, x, z) {
    const gridX = Math.round(x);
    const gridZ = Math.round(z);
    const surface = terrainSurfaceAt(state.seed, gridX, gridZ);
    if (Math.abs(creatureGroundY(entity.type, surface) - entity.position[1]) > 1.1 || hasLakeWater(state.seed, gridX, gridZ, surface)) return true;
    const blockId = getBlock(state.chunks, [Math.round(x), Math.round(surface + 1), Math.round(z)]);
    return Boolean(blockId && (BLOCK_BY_ID[blockId]?.solid || BLOCK_BY_ID[blockId]?.fluid));
}

export function updateCreature(entity, state, now, deltaSeconds) {
    const dx = state.playerPosition[0] - entity.position[0];
    const dz = state.playerPosition[2] - entity.position[2];
    const playerDistance = Math.hypot(dx, dz);
    if (playerDistance > CREATURE_UPDATE_DISTANCE) return entity;

    let heading = entity.heading;
    let speed = 0;
    if (entity.friendLevel > 0 && entity.followUntil > now) {
        if (playerDistance > 2.5) {
            heading = Math.atan2(dx, dz);
            speed = 1.15;
        }
    } else {
        const cycle = Math.floor(now / 4000);
        const activity = randomAt(seedToNumber(entity.id) + 401, cycle, 0, 0);
        if (activity > 0.34) {
            heading = randomAt(seedToNumber(entity.id) + 503, cycle, 0, 0) * Math.PI * 2;
            speed = 0.55;
        }
    }

    let nextX = entity.position[0] + Math.sin(heading) * speed * deltaSeconds;
    let nextZ = entity.position[2] + Math.cos(heading) * speed * deltaSeconds;
    if (speed > 0 && blocked(state, entity, nextX, nextZ)) {
        heading += Math.PI / 2;
        speed = 0;
        nextX = entity.position[0];
        nextZ = entity.position[2];
    }
    const y = creatureGroundY(entity.type, terrainSurfaceAt(state.seed, nextX, nextZ));
    return {
        ...entity,
        position: [nextX, y, nextZ],
        velocity: speed > 0
            ? [Math.sin(heading) * speed, 0, Math.cos(heading) * speed]
            : [0, 0, 0],
        heading,
        animationState: speed > 0 ? "walking" : (now - entity.lastInteraction < 1200 ? "happy" : "idle"),
        chunk: [chunkCoordinate(nextX), chunkCoordinate(nextZ)],
    };
}

export function interactWithCreature(entity, now) {
    if (now - entity.lastInteraction < CREATURE_INTERACTION_COOLDOWN) return {entity, gift: null, changed: false};
    const friendLevel = Math.min(5, entity.friendLevel + 1);
    const canGift = now - entity.lastGift >= CREATURE_GIFT_COOLDOWN || entity.friendLevel === 0;
    return {
        entity: {
            ...entity,
            friendLevel,
            followUntil: now + 45000,
            lastInteraction: now,
            lastGift: canGift ? now : entity.lastGift,
            persistent: true,
            animationState: "happy",
        },
        gift: canGift ? CREATURE_TYPES[entity.type].gift : null,
        changed: true,
    };
}

export function validCreature(entity) {
    return Boolean(entity
        && typeof entity.id === "string"
        && CREATURE_TYPES[entity.type]
        && Array.isArray(entity.position)
        && entity.position.length === 3
        && entity.position.every(Number.isFinite)
        && Number.isFinite(entity.health)
        && entity.health > 0
        && entity.health <= CREATURE_TYPES[entity.type].maxHealth
    );
}
