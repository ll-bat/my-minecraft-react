import {randomAt, seedToNumber} from "./noise";
import {CHUNK_SIZE, chunkKey, localIndex} from "./chunks";
import {BIOMES, biomeAt, hasLakeWater, surfaceHeight, WORLD_MAX_Y} from "./terrain";

const HOUSE_CELL_SIZE = 4;
const LANDMARK_CELL_SIZE = 7;
const CITY_RADIUS = 1;
const cityPlanCache = new Map();

function mutableSetBlock(chunks, [x, y, z], blockId) {
    const chunkX = Math.floor(x / CHUNK_SIZE);
    const chunkY = Math.floor(y / CHUNK_SIZE);
    const chunkZ = Math.floor(z / CHUNK_SIZE);
    const localX = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localY = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localZ = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const key = chunkKey(chunkX, chunkY, chunkZ);
    const chunk = chunks.get(key);
    if (!chunk && blockId === null) return;
    const target = chunk ?? new Map();
    const index = localIndex(localX, localY, localZ);
    if (blockId === null) target.delete(index);
    else target.set(index, blockId);
    if (target.size) chunks.set(key, target);
    else chunks.delete(key);
}

function siteForStructure(seed, centerX, centerZ, bounds, maximumSlope) {
    const footprint = [];
    for (let dx = bounds.minX; dx <= bounds.maxX; dx += 1) {
        for (let dz = bounds.minZ; dz <= bounds.maxZ; dz += 1) {
            const x = centerX + dx;
            const z = centerZ + dz;
            const surface = surfaceHeight(seed, x, z);
            if (hasLakeWater(seed, x, z, surface)) return null;
            footprint.push({x, z, surface});
        }
    }
    const minimum = Math.min(...footprint.map(({surface}) => surface));
    const baseY = Math.max(...footprint.map(({surface}) => surface));
    return baseY - minimum <= maximumSlope ? {baseY, footprint} : null;
}

function cityPlan(seed) {
    if (cityPlanCache.has(seed)) return cityPlanCache.get(seed);
    const numericSeed = seedToNumber(`${seed}:only-city`);
    let best = null;
    for (let candidate = 0; candidate < 16; candidate += 1) {
        const angle = randomAt(numericSeed + 101, candidate, 0, 0) * Math.PI * 2;
        const radius = 4 + Math.floor(randomAt(numericSeed + 211, candidate, 0, 0) * 2);
        const chunkX = Math.round(Math.cos(angle) * radius);
        const chunkZ = Math.round(Math.sin(angle) * radius);
        const heights = [];
        let wet = 0;
        let mountains = 0;
        for (let dx = -20; dx <= 20; dx += 4) for (let dz = -20; dz <= 20; dz += 4) {
            const x = chunkX * CHUNK_SIZE + 8 + dx;
            const z = chunkZ * CHUNK_SIZE + 8 + dz;
            const surface = surfaceHeight(seed, x, z);
            heights.push(surface);
            if (hasLakeWater(seed, x, z, surface)) wet += 1;
            if (biomeAt(seed, x, z) === BIOMES.MOUNTAINS) mountains += 1;
        }
        const sorted = heights.sort((left, right) => left - right);
        const baseY = sorted[Math.floor(sorted.length / 2)];
        const range = sorted[sorted.length - 1] - sorted[0];
        const score = range * 12 + wet * 5 + mountains * 3 + randomAt(numericSeed + 307, candidate, 0, 0);
        if (!best || score < best.score) best = {chunkX, chunkZ, baseY, score};
    }
    const plan = {...best, id: `overworld:city:${best.chunkX},${best.chunkZ}`};
    cityPlanCache.set(seed, plan);
    return plan;
}

export function cityForColumn(seed, chunkX, chunkZ) {
    const plan = cityPlan(seed);
    const districtX = chunkX - plan.chunkX;
    const districtZ = chunkZ - plan.chunkZ;
    if (Math.abs(districtX) > CITY_RADIUS || Math.abs(districtZ) > CITY_RADIUS) return null;
    const biome = biomeAt(seed, plan.chunkX * CHUNK_SIZE + 8, plan.chunkZ * CHUNK_SIZE + 8);
    const stylePrefix = biome === BIOMES.DESERT ? "sunstone" : biome === BIOMES.FOREST ? "woodland" : biome === BIOMES.MOUNTAINS ? "alpine" : "garden";
    return {
        id: plan.id,
        type: "city",
        style: `${stylePrefix}_city`,
        biome,
        chunkX,
        chunkZ,
        cityCenterChunkX: plan.chunkX,
        cityCenterChunkZ: plan.chunkZ,
        districtX,
        districtZ,
        baseY: plan.baseY,
    };
}

export function cityCenter(seed) {
    const plan = cityPlan(seed);
    return [plan.chunkX * CHUNK_SIZE + 8, plan.baseY + 1, plan.chunkZ * CHUNK_SIZE + 8];
}

function landmarkForColumn(seed, chunkX, chunkZ) {
    const seedNumber = seedToNumber(`${seed}:landmarks`);
    const cellX = Math.floor(chunkX / LANDMARK_CELL_SIZE);
    const cellZ = Math.floor(chunkZ / LANDMARK_CELL_SIZE);
    if (randomAt(seedNumber + 401, cellX, 0, cellZ) < 0.25) return null;
    const candidateX = cellX * LANDMARK_CELL_SIZE
        + Math.floor(randomAt(seedNumber + 503, cellX, 0, cellZ) * LANDMARK_CELL_SIZE);
    const candidateZ = cellZ * LANDMARK_CELL_SIZE
        + Math.floor(randomAt(seedNumber + 607, cellX, 0, cellZ) * LANDMARK_CELL_SIZE);
    if (candidateX !== chunkX || candidateZ !== chunkZ) return null;
    const centerX = chunkX * CHUNK_SIZE + 8;
    const centerZ = chunkZ * CHUNK_SIZE + 8;
    const typeRoll = randomAt(seedNumber + 709, cellX, 0, cellZ);
    const type = typeRoll < 0.28 ? "village" : typeRoll < 0.58 ? "hotel" : "building";
    const bounds = type === "hotel"
        ? {minX: -7, maxX: 7, minZ: -6, maxZ: 6}
        : {minX: -7, maxX: 7, minZ: -7, maxZ: 7};
    const site = siteForStructure(seed, centerX, centerZ, bounds, type === "hotel" ? 2 : 3);
    const requiredHeadroom = type === "village" ? 8 : type === "hotel" ? 19 : 23;
    if (!site || site.baseY + requiredHeadroom > WORLD_MAX_Y) return null;
    const biome = biomeAt(seed, centerX, centerZ);
    const stylePrefix = {
        [BIOMES.PLAINS]: "garden",
        [BIOMES.FOREST]: "woodland",
        [BIOMES.DESERT]: "sunstone",
        [BIOMES.MOUNTAINS]: "alpine",
    }[biome];
    return {type, style: `${stylePrefix}_${type}`, biome};
}

function houseForColumn(seed, chunkX, chunkZ) {
    const seedNumber = seedToNumber(`${seed}:houses`);
    const cellX = Math.floor(chunkX / HOUSE_CELL_SIZE);
    const cellZ = Math.floor(chunkZ / HOUSE_CELL_SIZE);
    if (randomAt(seedNumber + 101, cellX, 0, cellZ) < 0.25) return null;
    const candidateX = cellX * HOUSE_CELL_SIZE
        + Math.floor(randomAt(seedNumber + 211, cellX, 0, cellZ) * HOUSE_CELL_SIZE);
    const candidateZ = cellZ * HOUSE_CELL_SIZE
        + Math.floor(randomAt(seedNumber + 307, cellX, 0, cellZ) * HOUSE_CELL_SIZE);
    if (candidateX !== chunkX || candidateZ !== chunkZ) return null;
    const centerX = chunkX * CHUNK_SIZE + 8;
    const centerZ = chunkZ * CHUNK_SIZE + 8;
    const surfaces = [];
    for (let dx = -5; dx <= 5; dx += 1) {
        for (let dz = -5; dz <= 7; dz += 1) {
            const surface = surfaceHeight(seed, centerX + dx, centerZ + dz);
            if (hasLakeWater(seed, centerX + dx, centerZ + dz, surface)) return null;
            surfaces.push(surface);
        }
    }
    if (Math.max(...surfaces) - Math.min(...surfaces) > 3) return null;
    const biome = biomeAt(seed, centerX, centerZ);
    const styles = {
        [BIOMES.PLAINS]: "meadow_cottage",
        [BIOMES.FOREST]: "forest_lodge",
        [BIOMES.DESERT]: "desert_house",
        [BIOMES.MOUNTAINS]: "mountain_chalet",
    };
    return {type: "house", style: styles[biome], biome};
}

export function structureForColumn(seed, chunkX, chunkZ, dimension = "overworld") {
    if (Math.abs(chunkX) <= 1 && Math.abs(chunkZ) <= 1) return null;
    if (dimension === "overworld") {
        const city = cityForColumn(seed, chunkX, chunkZ);
        if (city) return city;
        const landmark = landmarkForColumn(seed, chunkX, chunkZ);
        if (landmark) return {id: `${dimension}:${chunkX},${chunkZ}`, ...landmark, chunkX, chunkZ};
        const house = houseForColumn(seed, chunkX, chunkZ);
        if (house) return {id: `${dimension}:${chunkX},${chunkZ}`, ...house, chunkX, chunkZ};
    }
    const roll = randomAt(seedToNumber(`${seed}:${dimension}:structures`), chunkX, 0, chunkZ);
    if (roll < 0.95) return null;
    const types = dimension === "dream_grove" ? ["crystal_garden"] : ["ruin", "camp", "well"];
    return {id: `${dimension}:${chunkX},${chunkZ}`, type: types[Math.floor(roll * 1000) % types.length], chunkX, chunkZ};
}

function housePalette(style) {
    if (style === "forest_lodge") return {foundation: "mossy_stone", floor: "wood", frame: "log", wall: "wood", roof: "red_wood"};
    if (style === "desert_house") return {foundation: "polished_stone", floor: "pale_wood", frame: "pale_log", wall: "pale_wood", roof: "sand"};
    if (style === "mountain_chalet") return {foundation: "gray_brick", floor: "wood", frame: "log", wall: "pale_wood", roof: "gray_brick"};
    return {foundation: "red_brick", floor: "wood", frame: "pale_log", wall: "pale_wood", roof: "red_wood"};
}

function addHouse(chunks, seed, structure, centerX, centerZ) {
    const terrainSeed = structure.dimensionSeed ?? seed;
    const footprint = [];
    for (let dx = -5; dx <= 5; dx += 1) {
        for (let dz = -5; dz <= 7; dz += 1) {
            const x = centerX + dx;
            const z = centerZ + dz;
            const surface = surfaceHeight(terrainSeed, x, z);
            if (hasLakeWater(terrainSeed, x, z, surface)) return false;
            footprint.push({x, z, surface});
        }
    }
    const minimum = Math.min(...footprint.map(({surface}) => surface));
    const baseY = Math.max(...footprint.map(({surface}) => surface));
    if (baseY - minimum > 3) return false;

    const palette = housePalette(structure.style);
    footprint.forEach(({x, z}) => {
        for (let y = baseY + 1; y <= baseY + 10; y += 1) mutableSetBlock(chunks, [x, y, z], null);
    });

    for (let dx = -4; dx <= 4; dx += 1) {
        for (let dz = -4; dz <= 4; dz += 1) {
            const surface = surfaceHeight(terrainSeed, centerX + dx, centerZ + dz);
            for (let y = surface + 1; y <= baseY; y += 1) {
                mutableSetBlock(chunks, [centerX + dx, y, centerZ + dz], palette.foundation);
            }
            mutableSetBlock(chunks, [centerX + dx, baseY, centerZ + dz], palette.floor);
        }
    }

    const isWindow = (dx, dz, dy) => dy >= 2 && dy <= 3 && (
        (Math.abs(dz) === 4 && Math.abs(dx) === 2)
        || (Math.abs(dx) === 4 && Math.abs(dz) === 2)
    );
    for (let dy = 1; dy <= 4; dy += 1) {
        for (let dx = -4; dx <= 4; dx += 1) {
            for (let dz = -4; dz <= 4; dz += 1) {
                if (Math.abs(dx) !== 4 && Math.abs(dz) !== 4) continue;
                if (dz === 4 && dx === 0 && dy <= 2) continue;
                const corner = Math.abs(dx) === 4 && Math.abs(dz) === 4;
                const blockId = isWindow(dx, dz, dy) ? "window" : corner ? palette.frame : palette.wall;
                mutableSetBlock(chunks, [centerX + dx, baseY + dy, centerZ + dz], blockId);
            }
        }
    }

    mutableSetBlock(chunks, [centerX, baseY + 1, centerZ + 4], "door");
    mutableSetBlock(chunks, [centerX, baseY + 2, centerZ + 4], "door_top");

    for (let layer = 0; layer <= 5; layer += 1) {
        const roofX = 5 - layer;
        for (let dz = -5; dz <= 5; dz += 1) {
            mutableSetBlock(chunks, [centerX + roofX, baseY + 5 + layer, centerZ + dz], palette.roof);
            if (roofX) mutableSetBlock(chunks, [centerX - roofX, baseY + 5 + layer, centerZ + dz], palette.roof);
        }
        if (layer < 5) {
            for (let dx = -(4 - layer); dx <= 4 - layer; dx += 1) {
                mutableSetBlock(chunks, [centerX + dx, baseY + 5 + layer, centerZ - 4], palette.wall);
                mutableSetBlock(chunks, [centerX + dx, baseY + 5 + layer, centerZ + 4], palette.wall);
            }
        }
    }

    for (let y = baseY + 5; y <= baseY + 10; y += 1) {
        mutableSetBlock(chunks, [centerX + 2, y, centerZ - 2], "gray_brick");
    }

    mutableSetBlock(chunks, [centerX - 2, baseY + 1, centerZ - 2], "bed");
    mutableSetBlock(chunks, [centerX + 1, baseY + 1, centerZ - 1], "wood_table");
    mutableSetBlock(chunks, [centerX + 1, baseY + 1, centerZ + 1], "chair");
    mutableSetBlock(chunks, [centerX - 3, baseY + 1, centerZ], "shelf");
    mutableSetBlock(chunks, [centerX, baseY + 4, centerZ], "lantern");
    mutableSetBlock(chunks, [centerX - 2, baseY + 3, centerZ + 3], "wall_art");

    for (let dz = 5; dz <= 7; dz += 1) {
        const x = centerX;
        const z = centerZ + dz;
        mutableSetBlock(chunks, [x, surfaceHeight(terrainSeed, x, z) + 1, z], "stone_slab");
    }
    mutableSetBlock(chunks, [centerX - 2, surfaceHeight(terrainSeed, centerX - 2, centerZ + 6) + 1, centerZ + 6], "flowerpot");
    mutableSetBlock(chunks, [centerX + 2, surfaceHeight(terrainSeed, centerX + 2, centerZ + 6) + 1, centerZ + 6], "flowerpot");
    mutableSetBlock(chunks, [centerX - 4, surfaceHeight(terrainSeed, centerX - 4, centerZ + 6) + 1, centerZ + 6], "bench");
    return true;
}

function landmarkPalette(style) {
    if (style.startsWith("woodland")) {
        return {foundation: "mossy_stone", floor: "wood", wall: "pale_wood", frame: "log", accent: "red_wood", roof: "mossy_stone"};
    }
    if (style.startsWith("sunstone")) {
        return {foundation: "polished_stone", floor: "pale_wood", wall: "pale_wood", frame: "gray_brick", accent: "red_brick", roof: "sand"};
    }
    if (style.startsWith("alpine")) {
        return {foundation: "gray_brick", floor: "wood", wall: "pale_wood", frame: "gray_brick", accent: "mossy_stone", roof: "gray_brick"};
    }
    return {foundation: "red_brick", floor: "wood", wall: "pale_wood", frame: "pale_log", accent: "red_wood", roof: "gray_brick"};
}

function prepareLandmarkSite(chunks, terrainSeed, centerX, centerZ, bounds, maximumSlope, topY, foundation) {
    const site = siteForStructure(terrainSeed, centerX, centerZ, bounds, maximumSlope);
    if (!site || site.baseY + topY > WORLD_MAX_Y) return null;
    site.footprint.forEach(({x, z, surface}) => {
        for (let y = site.baseY + 1; y <= site.baseY + topY; y += 1) mutableSetBlock(chunks, [x, y, z], null);
        for (let y = surface + 1; y <= site.baseY; y += 1) mutableSetBlock(chunks, [x, y, z], foundation);
        mutableSetBlock(chunks, [x, site.baseY, z], foundation);
    });
    return site;
}

function addHotel(chunks, seed, structure, centerX, centerZ) {
    const terrainSeed = structure.dimensionSeed ?? seed;
    const palette = landmarkPalette(structure.style);
    const site = prepareLandmarkSite(
        chunks,
        terrainSeed,
        centerX,
        centerZ,
        {minX: -7, maxX: 7, minZ: -6, maxZ: 6},
        2,
        19,
        palette.foundation
    );
    if (!site) return false;
    const baseY = site.baseY;
    const floors = 4;
    const floorHeight = 4;

    for (let floor = 0; floor < floors; floor += 1) {
        const floorY = baseY + floor * floorHeight;
        for (let dx = -7; dx <= 1; dx += 1) {
            for (let dz = -5; dz <= 5; dz += 1) {
                mutableSetBlock(chunks, [centerX + dx, floorY, centerZ + dz], palette.floor);
            }
        }
        for (let dy = 1; dy <= 3; dy += 1) {
            for (let dx = -7; dx <= 1; dx += 1) {
                for (let dz = -5; dz <= 5; dz += 1) {
                    if (dx !== -7 && dx !== 1 && dz !== -5 && dz !== 5) continue;
                    const entrance = floor === 0 && dz === 5 && (dx === -4 || dx === -2) && dy <= 2;
                    if (entrance) continue;
                    const corner = (dx === -7 || dx === 1) && (dz === -5 || dz === 5);
                    const window = dy <= 2 && !corner && (
                        ((dz === -5 || dz === 5) && Math.abs(dx + 3) % 2 === 1)
                        || ((dx === -7 || dx === 1) && Math.abs(dz) % 2 === 0)
                    );
                    mutableSetBlock(chunks, [centerX + dx, floorY + dy, centerZ + dz], corner ? palette.frame : window ? "window" : palette.wall);
                }
            }
        }
        if (floor > 0) {
            for (let dx = -6; dx <= 0; dx += 1) mutableSetBlock(chunks, [centerX + dx, floorY, centerZ + 6], "wood_slab");
            for (let dx = -6; dx <= 0; dx += 1) mutableSetBlock(chunks, [centerX + dx, floorY + 1, centerZ + 6], "wood_railing");
        }
        mutableSetBlock(chunks, [centerX - 5, floorY + 1, centerZ - 2], "bed");
        mutableSetBlock(chunks, [centerX - 2, floorY + 1, centerZ - 2], "bed");
        mutableSetBlock(chunks, [centerX - 4, floorY + 1, centerZ + 1], "wood_table");
        mutableSetBlock(chunks, [centerX - 3, floorY + 1, centerZ + 1], "chair");
        mutableSetBlock(chunks, [centerX - 1, floorY + 1, centerZ + 3], floor === 0 ? "cabinet" : "shelf");
        mutableSetBlock(chunks, [centerX - 3, floorY + 3, centerZ], "lantern");
        mutableSetBlock(chunks, [centerX, floorY, centerZ - 3], "elevator");
    }

    const roofY = baseY + floors * floorHeight;
    for (let dx = -7; dx <= 1; dx += 1) for (let dz = -5; dz <= 5; dz += 1) {
        mutableSetBlock(chunks, [centerX + dx, roofY, centerZ + dz], palette.roof);
        if (dx === -7 || dx === 1 || dz === -5 || dz === 5) {
            mutableSetBlock(chunks, [centerX + dx, roofY + 1, centerZ + dz], "wood_railing");
        }
    }
    for (let y = baseY + 1; y <= roofY; y += 1) mutableSetBlock(chunks, [centerX, y, centerZ - 4], "ladder");
    [[-6, -4], [0, -4], [-6, 4], [0, 4]].forEach(([dx, dz]) => {
        mutableSetBlock(chunks, [centerX + dx, roofY + 1, centerZ + dz], "lantern");
    });

    [-4, -2].forEach((dx) => {
        mutableSetBlock(chunks, [centerX + dx, baseY + 1, centerZ + 5], "door");
        mutableSetBlock(chunks, [centerX + dx, baseY + 2, centerZ + 5], "door_top");
    });
    mutableSetBlock(chunks, [centerX - 3, baseY + 1, centerZ + 4], "rug");
    mutableSetBlock(chunks, [centerX - 6, baseY + 2, centerZ + 4], "wall_art");

    for (let dx = 3; dx <= 7; dx += 1) for (let dz = -5; dz <= 5; dz += 1) {
        const inWater = dx >= 4 && dx <= 6 && dz >= -4 && dz <= 3;
        if (inWater) {
            mutableSetBlock(chunks, [centerX + dx, baseY - 2, centerZ + dz], "polished_stone");
            mutableSetBlock(chunks, [centerX + dx, baseY - 1, centerZ + dz], "water");
            mutableSetBlock(chunks, [centerX + dx, baseY, centerZ + dz], "water");
        } else {
            mutableSetBlock(chunks, [centerX + dx, baseY, centerZ + dz], "polished_stone");
        }
    }
    for (let dz = -5; dz <= 4; dz += 1) {
        mutableSetBlock(chunks, [centerX + 3, baseY + 1, centerZ + dz], "wood_railing");
        mutableSetBlock(chunks, [centerX + 7, baseY + 1, centerZ + dz], "wood_railing");
    }
    for (let dx = 3; dx <= 7; dx += 1) mutableSetBlock(chunks, [centerX + dx, baseY + 1, centerZ - 5], "wood_railing");
    mutableSetBlock(chunks, [centerX + 4, baseY + 1, centerZ + 5], "bench");
    mutableSetBlock(chunks, [centerX + 6, baseY + 1, centerZ + 5], "bench");
    mutableSetBlock(chunks, [centerX + 3, baseY + 1, centerZ + 5], "flowerpot");
    mutableSetBlock(chunks, [centerX + 7, baseY + 1, centerZ + 5], "flowerpot");
    for (let dz = 6; dz <= 7; dz += 1) {
        const z = centerZ + dz;
        mutableSetBlock(chunks, [centerX - 3, surfaceHeight(terrainSeed, centerX - 3, z) + 1, z], "stone_slab");
    }
    return true;
}

function addBuilding(chunks, seed, structure, centerX, centerZ) {
    const terrainSeed = structure.dimensionSeed ?? seed;
    const palette = landmarkPalette(structure.style);
    const site = prepareLandmarkSite(
        chunks,
        terrainSeed,
        centerX,
        centerZ,
        {minX: -7, maxX: 7, minZ: -7, maxZ: 7},
        3,
        23,
        palette.foundation
    );
    if (!site) return false;
    const baseY = site.baseY;
    const floors = 5;
    const floorHeight = 4;

    for (let floor = 0; floor < floors; floor += 1) {
        const floorY = baseY + floor * floorHeight;
        for (let dx = -5; dx <= 5; dx += 1) for (let dz = -5; dz <= 5; dz += 1) {
            mutableSetBlock(chunks, [centerX + dx, floorY, centerZ + dz], palette.floor);
        }
        for (let dy = 1; dy <= 3; dy += 1) {
            for (let dx = -5; dx <= 5; dx += 1) for (let dz = -5; dz <= 5; dz += 1) {
                if (Math.abs(dx) !== 5 && Math.abs(dz) !== 5) continue;
                const entrance = floor === 0 && dz === 5 && (dx === -1 || dx === 1) && dy <= 2;
                if (entrance) continue;
                const corner = Math.abs(dx) === 5 && Math.abs(dz) === 5;
                const structuralColumn = (Math.abs(dx) === 5 ? Math.abs(dz) : Math.abs(dx)) % 3 === 2;
                const blockId = corner || structuralColumn ? palette.frame : dy <= 2 ? "window" : palette.wall;
                mutableSetBlock(chunks, [centerX + dx, floorY + dy, centerZ + dz], blockId);
            }
        }
        if (floor === 1 || floor === 3) {
            for (let dx = -4; dx <= 4; dx += 1) mutableSetBlock(chunks, [centerX + dx, floorY, centerZ + 6], "stone_slab");
            for (let dx = -4; dx <= 4; dx += 1) mutableSetBlock(chunks, [centerX + dx, floorY + 1, centerZ + 6], "wood_railing");
        }
        mutableSetBlock(chunks, [centerX - 3, floorY + 1, centerZ - 2], "bed");
        mutableSetBlock(chunks, [centerX + 1, floorY + 1, centerZ - 2], "wood_table");
        mutableSetBlock(chunks, [centerX + 2, floorY + 1, centerZ - 2], "chair");
        mutableSetBlock(chunks, [centerX - 3, floorY + 1, centerZ + 2], floor % 2 ? "cabinet" : "shelf");
        mutableSetBlock(chunks, [centerX, floorY + 1, centerZ + 1], "rug");
        mutableSetBlock(chunks, [centerX, floorY + 3, centerZ], "lantern");
        mutableSetBlock(chunks, [centerX + 3, floorY, centerZ - 3], "elevator");
    }

    const roofY = baseY + floors * floorHeight;
    for (let dx = -5; dx <= 5; dx += 1) for (let dz = -5; dz <= 5; dz += 1) {
        mutableSetBlock(chunks, [centerX + dx, roofY, centerZ + dz], palette.roof);
        if (Math.abs(dx) === 5 || Math.abs(dz) === 5) mutableSetBlock(chunks, [centerX + dx, roofY + 1, centerZ + dz], "wood_railing");
    }
    for (let y = baseY + 1; y <= roofY; y += 1) mutableSetBlock(chunks, [centerX + 4, y, centerZ - 4], "ladder");
    [[-4, -4], [4, -4], [-4, 4], [4, 4]].forEach(([dx, dz]) => {
        mutableSetBlock(chunks, [centerX + dx, roofY + 1, centerZ + dz], "lantern");
    });
    [-1, 1].forEach((dx) => {
        mutableSetBlock(chunks, [centerX + dx, baseY + 1, centerZ + 5], "door");
        mutableSetBlock(chunks, [centerX + dx, baseY + 2, centerZ + 5], "door_top");
    });
    for (let dz = 6; dz <= 7; dz += 1) mutableSetBlock(chunks, [centerX, baseY + 1, centerZ + dz], "stone_slab");
    mutableSetBlock(chunks, [centerX - 3, baseY + 1, centerZ + 7], "planter");
    mutableSetBlock(chunks, [centerX + 3, baseY + 1, centerZ + 7], "planter");
    mutableSetBlock(chunks, [centerX - 5, baseY + 1, centerZ + 7], "bench");
    mutableSetBlock(chunks, [centerX + 5, baseY + 1, centerZ + 7], "sign");
    return true;
}

function addVillage(chunks, seed, structure, centerX, centerZ) {
    const terrainSeed = structure.dimensionSeed ?? seed;
    const palette = landmarkPalette(structure.style);
    const site = prepareLandmarkSite(chunks, terrainSeed, centerX, centerZ, {minX: -7, maxX: 7, minZ: -7, maxZ: 7}, 3, 8, palette.foundation);
    if (!site) return false;
    const baseY = site.baseY;

    // A central square links three compact homes, a market stall, garden, and rail stop.
    for (let dx = -7; dx <= 7; dx += 1) {
        mutableSetBlock(chunks, [centerX + dx, baseY, centerZ], "stone_slab");
        mutableSetBlock(chunks, [centerX + dx, baseY + 1, centerZ], "track");
    }
    for (let dz = -7; dz <= 7; dz += 1) mutableSetBlock(chunks, [centerX, baseY, centerZ + dz], "stone_slab");

    const homes = [[-4, -4], [4, -4], [0, 4]];
    homes.forEach(([homeX, homeZ]) => {
        for (let dx = -2; dx <= 2; dx += 1) for (let dz = -2; dz <= 2; dz += 1) {
            mutableSetBlock(chunks, [centerX + homeX + dx, baseY, centerZ + homeZ + dz], palette.floor);
            for (let dy = 1; dy <= 3; dy += 1) {
                if (Math.abs(dx) !== 2 && Math.abs(dz) !== 2) continue;
                const facesSquare = homeZ < 0 ? dz === 2 : dz === -2;
                if (facesSquare && dx === 0 && dy <= 2) continue;
                const corner = Math.abs(dx) === 2 && Math.abs(dz) === 2;
                const window = dy === 2 && !corner && (dx === 0 || dz === 0);
                mutableSetBlock(chunks, [centerX + homeX + dx, baseY + dy, centerZ + homeZ + dz], corner ? palette.frame : window ? "window" : palette.wall);
            }
            mutableSetBlock(chunks, [centerX + homeX + dx, baseY + 4, centerZ + homeZ + dz], palette.roof);
        }
        const doorZ = centerZ + homeZ + (homeZ < 0 ? 2 : -2);
        mutableSetBlock(chunks, [centerX + homeX, baseY + 1, doorZ], "door");
        mutableSetBlock(chunks, [centerX + homeX, baseY + 2, doorZ], "door_top");
        mutableSetBlock(chunks, [centerX + homeX - 1, baseY + 1, centerZ + homeZ], "bed");
        mutableSetBlock(chunks, [centerX + homeX + 1, baseY + 1, centerZ + homeZ], "wood_table");
    });

    for (let dx = 3; dx <= 6; dx += 1) for (let dz = 2; dz <= 5; dz += 1) {
        mutableSetBlock(chunks, [centerX + dx, baseY, centerZ + dz], "farmland");
        if ((dx + dz) % 2 === 0) mutableSetBlock(chunks, [centerX + dx, baseY + 1, centerZ + dz], "crop_3");
    }
    for (let dx = -6; dx <= -3; dx += 1) {
        mutableSetBlock(chunks, [centerX + dx, baseY + 1, centerZ + 3], "wood_post");
        mutableSetBlock(chunks, [centerX + dx, baseY + 3, centerZ + 3], "red_wood");
    }
    mutableSetBlock(chunks, [centerX - 5, baseY + 1, centerZ + 4], "chest");
    mutableSetBlock(chunks, [centerX - 4, baseY + 1, centerZ + 4], "crate");
    mutableSetBlock(chunks, [centerX, baseY + 1, centerZ + 2], "lantern");
    return true;
}

function prepareCityDistrict(chunks, terrainSeed, structure, centerX, centerZ, foundation) {
    const baseY = structure.baseY;
    for (let dx = -8; dx <= 7; dx += 1) for (let dz = -8; dz <= 7; dz += 1) {
        const x = centerX + dx;
        const z = centerZ + dz;
        const surface = surfaceHeight(terrainSeed, x, z);
        for (let y = baseY + 1; y <= Math.max(surface, baseY + 23); y += 1) mutableSetBlock(chunks, [x, y, z], null);
        for (let y = surface + 1; y <= baseY; y += 1) mutableSetBlock(chunks, [x, y, z], foundation);
        mutableSetBlock(chunks, [x, baseY, z], foundation);
    }
    return baseY;
}

function addCityBuilding(chunks, centerX, centerZ, baseY, localX, localZ, floors, palette, variant = 0) {
    const half = 2;
    const floorHeight = 4;
    for (let floor = 0; floor < floors; floor += 1) {
        const floorY = baseY + floor * floorHeight;
        for (let dx = -half; dx <= half; dx += 1) for (let dz = -half; dz <= half; dz += 1) {
            mutableSetBlock(chunks, [centerX + localX + dx, floorY, centerZ + localZ + dz], palette.floor);
        }
        for (let dy = 1; dy <= 3; dy += 1) for (let dx = -half; dx <= half; dx += 1) for (let dz = -half; dz <= half; dz += 1) {
            if (Math.abs(dx) !== half && Math.abs(dz) !== half) continue;
            const entrance = floor === 0 && dz === (localZ < 0 ? half : -half) && dx === 0 && dy <= 2;
            if (entrance) continue;
            const corner = Math.abs(dx) === half && Math.abs(dz) === half;
            const window = !corner && dy <= 2 && ((Math.abs(dx) === half && dz === 0) || (Math.abs(dz) === half && Math.abs(dx) === 1));
            mutableSetBlock(chunks, [centerX + localX + dx, floorY + dy, centerZ + localZ + dz], corner ? palette.frame : window ? "window" : palette.wall);
        }
        mutableSetBlock(chunks, [centerX + localX - 1, floorY + 1, centerZ + localZ], floor % 2 ? "cabinet" : "bed");
        mutableSetBlock(chunks, [centerX + localX + 1, floorY + 1, centerZ + localZ], "wood_table");
        mutableSetBlock(chunks, [centerX + localX, floorY + 3, centerZ + localZ], "lantern");
        if (floors >= 3) mutableSetBlock(chunks, [centerX + localX + 1, floorY, centerZ + localZ - 1], "elevator");
    }
    const roofY = baseY + floors * floorHeight;
    for (let dx = -half; dx <= half; dx += 1) for (let dz = -half; dz <= half; dz += 1) {
        mutableSetBlock(chunks, [centerX + localX + dx, roofY, centerZ + localZ + dz], variant % 2 ? palette.accent : palette.roof);
        if (Math.abs(dx) === half || Math.abs(dz) === half) mutableSetBlock(chunks, [centerX + localX + dx, roofY + 1, centerZ + localZ + dz], "wood_railing");
    }
    const doorZ = centerZ + localZ + (localZ < 0 ? half : -half);
    mutableSetBlock(chunks, [centerX + localX, baseY + 1, doorZ], "door");
    mutableSetBlock(chunks, [centerX + localX, baseY + 2, doorZ], "door_top");
}

function addCityMarket(chunks, centerX, centerZ, baseY) {
    [[-5, -5], [5, -5], [-5, 5], [5, 5]].forEach(([localX, localZ], index) => {
        for (const dx of [-2, 2]) for (const dz of [-2, 2]) {
            mutableSetBlock(chunks, [centerX + localX + dx, baseY + 1, centerZ + localZ + dz], "wood_post");
            mutableSetBlock(chunks, [centerX + localX + dx, baseY + 2, centerZ + localZ + dz], "wood_post");
        }
        for (let dx = -2; dx <= 2; dx += 1) for (let dz = -2; dz <= 2; dz += 1) {
            mutableSetBlock(chunks, [centerX + localX + dx, baseY + 3, centerZ + localZ + dz], index % 2 ? "pale_wood" : "red_wood");
        }
        mutableSetBlock(chunks, [centerX + localX, baseY + 1, centerZ + localZ], index % 2 ? "barrel" : "crate");
        mutableSetBlock(chunks, [centerX + localX + 1, baseY + 1, centerZ + localZ], "basket");
    });
}

function addCityPark(chunks, centerX, centerZ, baseY) {
    for (let dx = -7; dx <= 7; dx += 1) for (let dz = -7; dz <= 7; dz += 1) {
        if (Math.abs(dx) > 2 && Math.abs(dz) > 2) mutableSetBlock(chunks, [centerX + dx, baseY, centerZ + dz], "grass");
    }
    [[-5, -5], [5, -5], [-5, 5], [5, 5]].forEach(([dx, dz], index) => {
        mutableSetBlock(chunks, [centerX + dx, baseY + 1, centerZ + dz], index % 2 ? "bush" : "flowerpot");
        mutableSetBlock(chunks, [centerX + dx + (dx < 0 ? 1 : -1), baseY + 1, centerZ + dz], "bench");
    });
}

function addCityPlaza(chunks, centerX, centerZ, baseY) {
    for (let dx = -7; dx <= 7; dx += 1) for (let dz = -7; dz <= 7; dz += 1) {
        mutableSetBlock(chunks, [centerX + dx, baseY, centerZ + dz], (dx + dz) % 2 ? "polished_stone" : "stone");
    }
    for (let dx = -2; dx <= 2; dx += 1) for (let dz = -2; dz <= 2; dz += 1) {
        const edge = Math.abs(dx) === 2 || Math.abs(dz) === 2;
        mutableSetBlock(chunks, [centerX + dx, baseY + 1, centerZ + dz], edge ? "stone_slab" : "water");
    }
    mutableSetBlock(chunks, [centerX, baseY + 2, centerZ], "polished_stone");
    mutableSetBlock(chunks, [centerX, baseY + 3, centerZ], "lantern");
    [[-5, -5], [5, -5], [-5, 5], [5, 5]].forEach(([dx, dz]) => mutableSetBlock(chunks, [centerX + dx, baseY + 1, centerZ + dz], "bench"));
}

function addCityDistrict(chunks, seed, structure, centerX, centerZ) {
    const terrainSeed = structure.dimensionSeed ?? seed;
    const palette = landmarkPalette(structure.style);
    const baseY = prepareCityDistrict(chunks, terrainSeed, structure, centerX, centerZ, palette.foundation);
    const central = structure.districtX === 0 && structure.districtZ === 0;
    const park = structure.districtX === -1 && structure.districtZ === 0;
    const market = structure.districtX === 0 && structure.districtZ === 1;

    // Every district receives the same aligned street cross, sidewalks, crossings, and lamps.
    for (let dx = -8; dx <= 7; dx += 1) for (let dz = -8; dz <= 7; dz += 1) {
        if (Math.abs(dx) <= 1 || Math.abs(dz) <= 1) mutableSetBlock(chunks, [centerX + dx, baseY, centerZ + dz], "gray_brick");
        else if (Math.abs(dx) === 2 || Math.abs(dz) === 2) mutableSetBlock(chunks, [centerX + dx, baseY, centerZ + dz], "polished_stone");
    }
    [[-2, -2], [2, -2], [-2, 2], [2, 2]].forEach(([dx, dz]) => {
        mutableSetBlock(chunks, [centerX + dx, baseY + 1, centerZ + dz], "wood_post");
        mutableSetBlock(chunks, [centerX + dx, baseY + 2, centerZ + dz], "lantern");
    });
    mutableSetBlock(chunks, [centerX + 3, baseY + 1, centerZ + 2], structure.districtX === 0 && structure.districtZ === 0 ? "sign" : "path_marker");

    if (central) addCityPlaza(chunks, centerX, centerZ, baseY);
    else if (park) addCityPark(chunks, centerX, centerZ, baseY);
    else if (market) addCityMarket(chunks, centerX, centerZ, baseY);
    else {
        const numericSeed = seedToNumber(`${seed}:city:${structure.districtX},${structure.districtZ}`);
        const positions = [[-5, -5], [5, -5], [-5, 5], [5, 5]];
        positions.forEach(([localX, localZ], index) => {
            if (index === 3 && randomAt(numericSeed + 101, index, 0, 0) < 0.45) {
                mutableSetBlock(chunks, [centerX + localX, baseY + 1, centerZ + localZ], "planter");
                mutableSetBlock(chunks, [centerX + localX + 1, baseY + 1, centerZ + localZ], "bench");
                return;
            }
            const floors = 2 + Math.floor(randomAt(numericSeed + 211, index, 0, 0) * 3);
            addCityBuilding(chunks, centerX, centerZ, baseY, localX, localZ, floors, palette, index);
        });
    }
    return true;
}

export function addStructure(chunks, seed, structure) {
    if (!structure) return chunks;
    // Generated structures are contained by their source column. Clone only
    // that column's vertical chunks so upgrading one city district does not
    // copy every block in a large explored world on the main thread.
    const next = new Map(chunks);
    chunks.forEach((chunk, key) => {
        const [chunkX, , chunkZ] = key.split(",").map(Number);
        if (chunkX === structure.chunkX && chunkZ === structure.chunkZ) {
            next.set(key, new Map(chunk));
        }
    });
    const centerX = structure.chunkX * CHUNK_SIZE + 8;
    const centerZ = structure.chunkZ * CHUNK_SIZE + 8;
    const terrainSeed = structure.dimensionSeed ?? seed;
    const y = surfaceHeight(terrainSeed, centerX, centerZ);
    if (structure.type === "house") {
        return addHouse(next, seed, structure, centerX, centerZ) ? next : chunks;
    }
    if (structure.type === "hotel") {
        return addHotel(next, seed, structure, centerX, centerZ) ? next : chunks;
    }
    if (structure.type === "building") {
        return addBuilding(next, seed, structure, centerX, centerZ) ? next : chunks;
    }
    if (structure.type === "village") {
        return addVillage(next, seed, structure, centerX, centerZ) ? next : chunks;
    }
    if (structure.type === "city") {
        return addCityDistrict(next, seed, structure, centerX, centerZ) ? next : chunks;
    }
    if (hasLakeWater(terrainSeed, centerX, centerZ, y)) return chunks;
    if (structure.type === "crystal_garden") {
        for (let dx = -2; dx <= 2; dx += 2) for (let dz = -2; dz <= 2; dz += 2) {
            const height = 1 + (Math.abs(dx + dz) % 3);
            for (let dy = 1; dy <= height; dy += 1) mutableSetBlock(next, [centerX + dx, y + dy, centerZ + dz], "crystal_block");
        }
        return next;
    }
    if (structure.type === "well") {
        for (let dx = -2; dx <= 2; dx += 1) for (let dz = -2; dz <= 2; dz += 1) {
            if (Math.abs(dx) === 2 || Math.abs(dz) === 2) mutableSetBlock(next, [centerX + dx, y + 1, centerZ + dz], "stone");
        }
        mutableSetBlock(next, [centerX, y + 1, centerZ], "water");
        return next;
    }
    const material = structure.type === "camp" ? "wood" : "stone";
    for (let dx = -3; dx <= 3; dx += 1) for (let dz = -3; dz <= 3; dz += 1) {
        if (Math.abs(dx) === 3 || Math.abs(dz) === 3) mutableSetBlock(next, [centerX + dx, y + 1, centerZ + dz], material);
    }
    for (let dy = 2; dy <= 3; dy += 1) {
        mutableSetBlock(next, [centerX - 3, y + dy, centerZ - 3], material);
        mutableSetBlock(next, [centerX + 3, y + dy, centerZ + 3], material);
    }
    return next;
}
