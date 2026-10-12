import {chunkCoordinate, getBlock} from "./chunks";
import {randomAt, seedToNumber} from "./noise";
import {BIOMES, biomeAt, hasNaturalWater, surfaceHeight} from "./terrain";
import {BLOCK_BY_ID} from "./blocks";

export const CREATURE_TYPES = {
    sheep: {name: "Sheep", maxHealth: 10, color: "#eee9df", gift: "flower", groundOffset: 0.775},
    rabbit: {name: "Rabbit", maxHealth: 8, color: "#b88455", gift: "stick", groundOffset: 0.425},
    glow_sprite: {name: "Glow Sprite", maxHealth: 12, color: "#ffe66d", gift: "coal", groundOffset: 0.275},
    villager: {name: "Villager", maxHealth: 20, color: "#b8794b", gift: "wheat", groundOffset: 0.9},
    horse: {name: "Horse", maxHealth: 24, color: "#845337", gift: "wheat", groundOffset: 0.9, rideable: true},
    boat: {name: "Boat", maxHealth: 16, color: "#a66b35", gift: null, groundOffset: 0.5, rideable: true},
    minecart: {name: "Minecart", maxHealth: 20, color: "#8b9298", gift: null, groundOffset: 0.625, rideable: true},
    fish_blue: {name: "Blue Reef Fish", maxHealth: 6, color: "#4597da", gift: null, groundOffset: 0, aquatic: true},
    fish_orange: {name: "Sunset Fish", maxHealth: 6, color: "#f28a32", gift: null, groundOffset: 0, aquatic: true},
    fish_pink: {name: "Rose Fish", maxHealth: 6, color: "#e76e9d", gift: null, groundOffset: 0, aquatic: true},
};

const FISH_TYPES = ["fish_blue", "fish_orange", "fish_pink"];

export const VILLAGER_PROFESSIONS = {
    farmer: {name: "Farmer", color: "#769245", dialogue: "The gardens are growing well today.", task: ["seeds", 4, "wheat", 6], trade: ["wheat", 4, "flower", 2]},
    builder: {name: "Builder", color: "#a86b3d", dialogue: "A welcoming town is built one block at a time.", task: ["stone", 6, "iron_ingot", 2], trade: ["log", 4, "wood", 8]},
    merchant: {name: "Merchant", color: "#7b5aa6", dialogue: "Welcome, friend. I always have something useful to exchange.", task: ["coal", 4, "gold_ingot", 1], trade: ["copper_ingot", 3, "crystal", 1]},
    innkeeper: {name: "Innkeeper", color: "#3b83a5", dialogue: "There is always a warm room waiting for a traveler.", task: ["flower", 3, "wheat", 4], trade: ["wheat", 3, "coal", 2]},
};

const VILLAGER_NAMES = ["Ari", "Mira", "Theo", "Nia", "Elio", "Sage", "Lina", "Oren", "Ivy", "Tomas", "Zoe", "Milo"];

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
        if (hasNaturalWater(seed, x, z, surface) || Math.hypot(x - playerPosition[0], z - playerPosition[2]) < 9) continue;
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

export function spawnFishForColumn(seed, chunkX, chunkZ, chunks, playerPosition) {
    const numericSeed = seedToNumber(`${seed}:fish`);
    const entities = [];
    for (let index = 0; index < 8 && entities.length < 3; index += 1) {
        const x = chunkX * 16 + 1 + Math.floor(randomAt(numericSeed + 101, chunkX, index, chunkZ) * 14);
        const z = chunkZ * 16 + 1 + Math.floor(randomAt(numericSeed + 211, chunkX, index, chunkZ) * 14);
        if (Math.hypot(x - playerPosition[0], z - playerPosition[2]) < 7) continue;
        const water = [];
        for (let y = 1; y <= 12; y += 1) if (getBlock(chunks, [x, y, z]) === "water") water.push(y);
        if (!water.length) continue;
        const type = FISH_TYPES[Math.floor(randomAt(numericSeed + 307, chunkX, index, chunkZ) * FISH_TYPES.length)];
        const y = water[Math.floor(randomAt(numericSeed + 401, chunkX, index, chunkZ) * water.length)];
        entities.push({
            id: `${type}:${chunkX},${chunkZ}:${index}:water`, type,
            position: [x, y, z], velocity: [0, 0, 0], health: CREATURE_TYPES[type].maxHealth,
            animationState: "swimming", heading: randomAt(numericSeed + 503, chunkX, index, chunkZ) * Math.PI * 2,
            friendLevel: 0, followUntil: 0, lastInteraction: 0, lastGift: 0, persistent: false,
            chunk: [chunkX, chunkZ],
        });
    }
    return entities;
}

function walkableY(chunks, seed, x, z, type = "villager") {
    const terrain = surfaceHeight(seed, x, z);
    for (let y = Math.min(terrain + 5, 95); y >= terrain - 1; y -= 1) {
        const block = BLOCK_BY_ID[getBlock(chunks, [x, y, z])];
        const above = getBlock(chunks, [x, y + 1, z]);
        if (block?.solid && !above) return creatureGroundY(type, y);
    }
    return creatureGroundY(type, terrain);
}

export function spawnCommunityForStructure(seed, structure, chunks) {
    if (!structure || !["house", "hotel", "building", "village", "city"].includes(structure.type)) return [];
    const entityGroupId = structure.type === "city"
        ? `${structure.id}:${structure.districtX},${structure.districtZ}`
        : structure.id;
    const numericSeed = seedToNumber(`${seed}:${entityGroupId}:community`);
    const centerX = structure.chunkX * 16 + 8;
    const centerZ = structure.chunkZ * 16 + 8;
    const count = structure.type === "house" ? 1 : structure.type === "village" ? 5 : structure.type === "hotel" ? 4 : structure.type === "city" ? 2 : 3;
    const professions = structure.type === "hotel"
        ? ["innkeeper", "merchant", "builder", "farmer"]
        : ["farmer", "builder", "merchant", "innkeeper"];
    const offsets = structure.type === "village"
        ? [[0, 1], [-2, 1], [2, 1], [-2, -1], [2, -1]]
        : structure.type === "city" ? [[0, 3], [0, -3]]
        : [[0, 6], [-4, 6], [4, 6], [-6, 1], [6, 1]];
    const entities = Array.from({length: count}, (_, index) => {
        const profession = professions[index % professions.length];
        const definition = VILLAGER_PROFESSIONS[profession];
        const [dx, dz] = offsets[index];
        const x = centerX + dx;
        const z = centerZ + dz;
        const [taskItem, taskCount, rewardItem, rewardCount] = definition.task;
        const [costItem, costCount, tradeItem, tradeCount] = definition.trade;
        return {
            id: `villager:${entityGroupId}:${index}`,
            type: "villager",
            name: VILLAGER_NAMES[Math.floor(randomAt(numericSeed + 101, index, 0, 0) * VILLAGER_NAMES.length)],
            profession,
            position: [x, structure.type === "city" ? creatureGroundY("villager", structure.baseY) : walkableY(chunks, seed, x, z), z],
            home: [centerX, centerZ],
            velocity: [0, 0, 0], health: CREATURE_TYPES.villager.maxHealth,
            animationState: "idle", heading: randomAt(numericSeed + 211, index, 0, 0) * Math.PI * 2,
            friendLevel: 0, followUntil: 0, lastInteraction: 0, lastGift: 0, persistent: true,
            task: {itemId: taskItem, count: taskCount, rewardItem, rewardCount, complete: false},
            trade: {costItem, costCount, rewardItem: tradeItem, rewardCount: tradeCount},
            chunk: [chunkCoordinate(x), chunkCoordinate(z)],
        };
    });
    if (structure.type === "village" || structure.type === "house") {
        const x = centerX + (structure.type === "village" ? 6 : 5);
        const z = centerZ + (structure.type === "village" ? 0 : 5);
        entities.push({
            id: `horse:${structure.id}`, type: "horse", position: [x, walkableY(chunks, seed, x, z, "horse"), z],
            velocity: [0, 0, 0], health: CREATURE_TYPES.horse.maxHealth, animationState: "idle", heading: 0,
            friendLevel: 1, followUntil: 0, lastInteraction: 0, lastGift: 0, persistent: true,
            chunk: [chunkCoordinate(x), chunkCoordinate(z)],
        });
    }
    if (structure.type === "village") {
        const x = centerX - 6;
        const z = centerZ;
        entities.push({
            id: `minecart:${structure.id}`, type: "minecart", position: [x, walkableY(chunks, seed, x, z, "minecart"), z],
            velocity: [0, 0, 0], health: CREATURE_TYPES.minecart.maxHealth, animationState: "idle", heading: Math.PI / 2,
            friendLevel: 1, followUntil: 0, lastInteraction: 0, lastGift: 0, persistent: true,
            chunk: [chunkCoordinate(x), chunkCoordinate(z)],
        });
    }
    return entities;
}

function blocked(state, entity, x, z) {
    const gridX = Math.round(x);
    const gridZ = Math.round(z);
    const startY = Math.floor(entity.position[1] + 0.6);
    let surface = terrainSurfaceAt(state.seed, gridX, gridZ);
    for (let y = startY; y >= startY - 3; y -= 1) {
        if (BLOCK_BY_ID[getBlock(state.chunks, [gridX, y, gridZ])]?.solid && !getBlock(state.chunks, [gridX, y + 1, gridZ])) {
            surface = y;
            break;
        }
    }
    if (Math.abs(creatureGroundY(entity.type, surface) - entity.position[1]) > 1.1 || hasNaturalWater(state.seed, gridX, gridZ, surface)) return true;
    const blockId = getBlock(state.chunks, [Math.round(x), Math.round(surface + 1), Math.round(z)]);
    return Boolean(blockId && (BLOCK_BY_ID[blockId]?.solid || BLOCK_BY_ID[blockId]?.fluid));
}

export function updateCreature(entity, state, now, deltaSeconds) {
    if (state.mountedEntityId === entity.id) return entity;
    if (entity.type === "boat") {
        const x = Math.round(entity.position[0]);
        const z = Math.round(entity.position[2]);
        const centerY = Math.floor(entity.position[1]);
        let waterSurface = null;
        for (let y = centerY - 2; y <= centerY + 12; y += 1) {
            if (getBlock(state.chunks, [x, y, z]) === "water") waterSurface = y;
        }
        return {
            ...entity,
            position: [entity.position[0], waterSurface === null ? entity.position[1] : waterSurface + CREATURE_TYPES.boat.groundOffset, entity.position[2]],
            velocity: [0, 0, 0],
            animationState: now - entity.lastInteraction < 1200 ? "happy" : "idle",
        };
    }
    if (entity.type === "minecart") {
        return {...entity, velocity: [0, 0, 0], animationState: now - entity.lastInteraction < 1200 ? "happy" : "idle"};
    }
    if (CREATURE_TYPES[entity.type]?.aquatic) {
        const dx = state.playerPosition[0] - entity.position[0];
        const dz = state.playerPosition[2] - entity.position[2];
        if (Math.hypot(dx, dz) > CREATURE_UPDATE_DISTANCE) return entity;
        const cycle = Math.floor(now / 3200);
        let heading = randomAt(seedToNumber(entity.id) + 811, cycle, 0, 0) * Math.PI * 2;
        const speed = 0.55 + randomAt(seedToNumber(entity.id) + 907, cycle, 0, 0) * 0.35;
        const vertical = (randomAt(seedToNumber(entity.id) + 1009, cycle, 0, 0) - 0.5) * 0.35;
        let next = [
            entity.position[0] + Math.sin(heading) * speed * deltaSeconds,
            entity.position[1] + vertical * deltaSeconds,
            entity.position[2] + Math.cos(heading) * speed * deltaSeconds,
        ];
        if (getBlock(state.chunks, next.map(Math.round)) !== "water") {
            heading = entity.heading + Math.PI * 0.72;
            next = entity.position;
        }
        return {
            ...entity, position: [...next], heading,
            velocity: next === entity.position ? [0, 0, 0] : [Math.sin(heading) * speed, vertical, Math.cos(heading) * speed],
            animationState: now - entity.lastInteraction < 1200 ? "happy" : "swimming",
            chunk: [chunkCoordinate(next[0]), chunkCoordinate(next[2])],
        };
    }
    const dx = state.playerPosition[0] - entity.position[0];
    const dz = state.playerPosition[2] - entity.position[2];
    const playerDistance = Math.hypot(dx, dz);
    if (playerDistance > CREATURE_UPDATE_DISTANCE) return entity;

    let heading = entity.heading;
    let speed = 0;
    if (entity.type === "villager") {
        const dayPhase = (state.worldTime % 360) / 360;
        const working = dayPhase > 0.18 && dayPhase < 0.72;
        const cycle = Math.floor(now / 5000);
        const radius = working ? 5 : 1.5;
        const targetX = entity.home[0] + (randomAt(seedToNumber(entity.id) + 701, cycle, 0, 0) - 0.5) * radius * 2;
        const targetZ = entity.home[1] + (randomAt(seedToNumber(entity.id) + 709, cycle, 0, 0) - 0.5) * radius * 2;
        const targetDistance = Math.hypot(targetX - entity.position[0], targetZ - entity.position[2]);
        if (targetDistance > 0.7) {
            heading = Math.atan2(targetX - entity.position[0], targetZ - entity.position[2]);
            speed = working ? 0.52 : 0.34;
        }
    } else if (entity.friendLevel > 0 && entity.followUntil > now && !CREATURE_TYPES[entity.type]?.rideable) {
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
    let nextSurface = terrainSurfaceAt(state.seed, nextX, nextZ);
    const gridX = Math.round(nextX);
    const gridZ = Math.round(nextZ);
    const startY = Math.floor(entity.position[1] + 0.6);
    for (let scanY = startY; scanY >= startY - 3; scanY -= 1) {
        if (BLOCK_BY_ID[getBlock(state.chunks, [gridX, scanY, gridZ])]?.solid && !getBlock(state.chunks, [gridX, scanY + 1, gridZ])) {
            nextSurface = scanY;
            break;
        }
    }
    const y = creatureGroundY(entity.type, nextSurface);
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
    if (entity.type === "villager" || CREATURE_TYPES[entity.type]?.rideable) {
        return {entity: {...entity, lastInteraction: now, animationState: "happy", persistent: true}, gift: null, changed: true};
    }
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
