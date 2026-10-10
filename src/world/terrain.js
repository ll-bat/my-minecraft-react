import {CHUNK_SIZE, chunkKey, localIndex} from "./chunks";
import {fractalNoise2D, fractalNoise3D, randomAt, seedToNumber} from "./noise";

export const WORLD_MIN_Y = -16;
export const WORLD_MAX_Y = 64;
export const SEA_LEVEL = 6;
const LAKE_CELL_SIZE = 32;

export const BIOMES = {
    PLAINS: "plains",
    FOREST: "forest",
    DESERT: "desert",
    MOUNTAINS: "mountains",
};

function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
}

export function biomeAt(seed, x, z) {
    const numericSeed = seedToNumber(seed);
    const temperature = fractalNoise2D(numericSeed + 1103, x, z, 180, 3);
    const moisture = fractalNoise2D(numericSeed + 2207, x, z, 150, 3);
    const mountainFactor = fractalNoise2D(numericSeed + 3301, x, z, 120, 4);

    if (mountainFactor > 0.42) {
        return BIOMES.MOUNTAINS;
    }
    if (temperature > 0.12 && moisture < -0.08) {
        return BIOMES.DESERT;
    }
    if (moisture > 0.08) {
        return BIOMES.FOREST;
    }
    return BIOMES.PLAINS;
}

export function surfaceHeight(seed, x, z) {
    const numericSeed = seedToNumber(seed);
    const biome = biomeAt(seed, x, z);
    const broad = fractalNoise2D(numericSeed + 4409, x, z, 75, 4);
    const detail = fractalNoise2D(numericSeed + 5503, x, z, 24, 3);

    if (biome === BIOMES.MOUNTAINS) {
        return clamp(Math.round(14 + Math.abs(broad) * 18 + detail * 6), 10, 42);
    }
    if (biome === BIOMES.DESERT) {
        return clamp(Math.round(5 + broad * 3 + detail), 2, 10);
    }
    if (biome === BIOMES.FOREST) {
        return clamp(Math.round(7 + broad * 5 + detail * 2), 3, 15);
    }
    return clamp(Math.round(6 + broad * 4 + detail * 2), 2, 13);
}

export function hasLakeWater(seed, x, z, surface = surfaceHeight(seed, x, z)) {
    if (surface >= SEA_LEVEL) {
        return false;
    }

    const numericSeed = seedToNumber(seed);
    const cellX = Math.floor(x / LAKE_CELL_SIZE);
    const cellZ = Math.floor(z / LAKE_CELL_SIZE);

    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        for (let offsetZ = -1; offsetZ <= 1; offsetZ += 1) {
            const lakeCellX = cellX + offsetX;
            const lakeCellZ = cellZ + offsetZ;
            if (randomAt(numericSeed + 15013, lakeCellX, 0, lakeCellZ) <= 0.58) {
                continue;
            }

            const centerX = lakeCellX * LAKE_CELL_SIZE
                + 6
                + randomAt(numericSeed + 16001, lakeCellX, 0, lakeCellZ) * 20;
            const centerZ = lakeCellZ * LAKE_CELL_SIZE
                + 6
                + randomAt(numericSeed + 17011, lakeCellX, 0, lakeCellZ) * 20;
            const radius = 5 + randomAt(numericSeed + 18013, lakeCellX, 0, lakeCellZ) * 4;
            const dx = x - centerX;
            const dz = z - centerZ;
            if (dx * dx + dz * dz <= radius * radius) {
                return true;
            }
        }
    }

    return false;
}

function isCave(numericSeed, x, y, z, surface) {
    if (y <= WORLD_MIN_Y + 2 || y >= surface - 4) {
        return false;
    }
    const cave = fractalNoise3D(numericSeed + 6607, x, y, z, 18, 3);
    const tunnel = fractalNoise3D(numericSeed + 7717, x, y * 0.7, z, 9, 2);
    return cave > 0.48 && tunnel > -0.05;
}

function undergroundBlock(numericSeed, x, y, z) {
    const crystal = fractalNoise3D(numericSeed + 10103, x, y, z, 3, 2);
    if (crystal > 0.73 && y < 2) return "crystal_ore";
    const gold = fractalNoise3D(numericSeed + 10009, x, y, z, 3.5, 2);
    if (gold > 0.7 && y < 8) return "gold_ore";
    const copper = fractalNoise3D(numericSeed + 9959, x, y, z, 4, 2);
    if (copper > 0.64 && y < 20) return "copper_ore";
    const coal = fractalNoise3D(numericSeed + 8803, x, y, z, 4, 2);
    if (coal > 0.6 && y < 28) {
        return "coal_ore";
    }

    const iron = fractalNoise3D(numericSeed + 9901, x, y, z, 3.5, 2);
    if (iron > 0.67 && y < 14) {
        return "iron_ore";
    }

    return "stone";
}

function putBlock(chunks, x, y, z, blockId, replace = true) {
    const chunkX = Math.floor(x / CHUNK_SIZE);
    const chunkY = Math.floor(y / CHUNK_SIZE);
    const chunkZ = Math.floor(z / CHUNK_SIZE);
    const localX = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localY = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localZ = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const key = chunkKey(chunkX, chunkY, chunkZ);
    const chunk = chunks.get(key) ?? new Map();
    const index = localIndex(localX, localY, localZ);

    if (replace || !chunk.has(index)) {
        chunk.set(index, blockId);
        chunks.set(key, chunk);
    }
}

function treeExists(seedNumber, x, z) {
    return randomAt(seedNumber + 12007, x, 0, z) > 0.972;
}

function addTreesAndPlants(chunks, seed, chunkX, chunkZ) {
    const numericSeed = seedToNumber(seed);
    const minX = chunkX * CHUNK_SIZE;
    const minZ = chunkZ * CHUNK_SIZE;
    const maxX = minX + CHUNK_SIZE - 1;
    const maxZ = minZ + CHUNK_SIZE - 1;

    for (let originX = minX - 3; originX <= maxX + 3; originX += 1) {
        for (let originZ = minZ - 3; originZ <= maxZ + 3; originZ += 1) {
            const biome = biomeAt(seed, originX, originZ);
            const surface = surfaceHeight(seed, originX, originZ);

            if (hasLakeWater(seed, originX, originZ, surface)) {
                continue;
            }

            if (biome === BIOMES.FOREST && treeExists(numericSeed, originX, originZ)) {
                const trunkHeight = 4 + Math.floor(randomAt(numericSeed + 13001, originX, 0, originZ) * 3);
                for (let y = 1; y <= trunkHeight; y += 1) {
                    if (originX >= minX && originX <= maxX && originZ >= minZ && originZ <= maxZ) {
                        putBlock(chunks, originX, surface + y, originZ, "log");
                    }
                }

                for (let dx = -2; dx <= 2; dx += 1) {
                    for (let dz = -2; dz <= 2; dz += 1) {
                        for (let dy = -1; dy <= 2; dy += 1) {
                            const x = originX + dx;
                            const z = originZ + dz;
                            if (x < minX || x > maxX || z < minZ || z > maxZ) {
                                continue;
                            }
                            if (Math.abs(dx) + Math.abs(dz) + Math.max(dy, 0) <= 4) {
                                putBlock(chunks, x, surface + trunkHeight + dy, z, "leaves", false);
                            }
                        }
                    }
                }
                continue;
            }

            if (originX < minX || originX > maxX || originZ < minZ || originZ > maxZ) {
                continue;
            }

            const plantChance = randomAt(numericSeed + 14009, originX, 0, originZ);
            if ((biome === BIOMES.PLAINS || biome === BIOMES.FOREST) && plantChance > 0.9) {
                putBlock(
                    chunks,
                    originX,
                    surface + 1,
                    originZ,
                    plantChance > 0.985 ? "flower" : "tall_grass"
                );
            }
        }
    }
}

export function generateChunkColumn(seed, chunkX, chunkZ) {
    const chunks = new Map();
    const numericSeed = seedToNumber(seed);
    const minX = chunkX * CHUNK_SIZE;
    const minZ = chunkZ * CHUNK_SIZE;

    for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
        for (let localZ = 0; localZ < CHUNK_SIZE; localZ += 1) {
            const x = minX + localX;
            const z = minZ + localZ;
            const biome = biomeAt(seed, x, z);
            const surface = surfaceHeight(seed, x, z);
            const lakeWater = hasLakeWater(seed, x, z, surface);

            for (let y = WORLD_MIN_Y; y <= surface; y += 1) {
                let blockId;
                if (y === WORLD_MIN_Y) {
                    blockId = "bedrock";
                } else if (isCave(numericSeed, x, y, z, surface)) {
                    continue;
                } else if ((biome === BIOMES.DESERT || lakeWater) && y >= surface - 3) {
                    blockId = "sand";
                } else if (y === surface) {
                    blockId = biome === BIOMES.MOUNTAINS && surface > 24 ? "stone" : "grass";
                } else if (y >= surface - 3) {
                    blockId = "dirt";
                } else {
                    blockId = undergroundBlock(numericSeed, x, y, z);
                }
                putBlock(chunks, x, y, z, blockId);
            }

            if (lakeWater) {
                for (let y = surface + 1; y <= SEA_LEVEL; y += 1) {
                    putBlock(chunks, x, y, z, "water");
                }
            }
        }
    }

    addTreesAndPlants(chunks, seed, chunkX, chunkZ);
    return chunks;
}

export function spawnPosition(seed) {
    const numericSeed = seedToNumber(seed);
    for (let radius = 0; radius <= 24; radius += 1) {
        for (let x = -radius; x <= radius; x += 1) {
            for (let z = -radius; z <= radius; z += 1) {
                if (Math.max(Math.abs(x), Math.abs(z)) !== radius) {
                    continue;
                }
                const biome = biomeAt(seed, x, z);
                let treeNearby = false;
                for (let dx = -2; dx <= 2; dx += 1) {
                    for (let dz = -2; dz <= 2; dz += 1) {
                        if (
                            biomeAt(seed, x + dx, z + dz) === BIOMES.FOREST
                            && treeExists(numericSeed, x + dx, z + dz)
                        ) {
                            treeNearby = true;
                        }
                    }
                }
                const surface = surfaceHeight(seed, x, z);
                if (biome !== BIOMES.MOUNTAINS && !hasLakeWater(seed, x, z, surface) && !treeNearby) {
                    return [x, surface + 2, z];
                }
            }
        }
    }
    return [0, surfaceHeight(seed, 0, 0) + 2, 0];
}
