import {randomAt, seedToNumber} from "./noise";
import {CHUNK_SIZE, chunkKey, localIndex} from "./chunks";
import {BIOMES, biomeAt, hasLakeWater, surfaceHeight} from "./terrain";

const HOUSE_CELL_SIZE = 4;
const LANDMARK_CELL_SIZE = 7;

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
    const type = randomAt(seedNumber + 709, cellX, 0, cellZ) < 0.45 ? "hotel" : "building";
    const bounds = type === "hotel"
        ? {minX: -7, maxX: 7, minZ: -6, maxZ: 6}
        : {minX: -7, maxX: 7, minZ: -7, maxZ: 7};
    if (!siteForStructure(seed, centerX, centerZ, bounds, type === "hotel" ? 2 : 3)) return null;
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
    if (!site) return null;
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

export function addStructure(chunks, seed, structure) {
    if (!structure) return chunks;
    const next = new Map(Array.from(chunks, ([key, chunk]) => [key, new Map(chunk)]));
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
