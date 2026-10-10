import {randomAt, seedToNumber} from "./noise";
import {setBlock} from "./chunks";
import {hasLakeWater, surfaceHeight} from "./terrain";

export function structureForColumn(seed, chunkX, chunkZ, dimension = "overworld") {
    if (Math.abs(chunkX) <= 1 && Math.abs(chunkZ) <= 1) return null;
    const roll = randomAt(seedToNumber(`${seed}:${dimension}:structures`), chunkX, 0, chunkZ);
    if (roll < 0.93) return null;
    const types = dimension === "dream_grove" ? ["crystal_garden"] : ["ruin", "camp", "well"];
    return {id: `${dimension}:${chunkX},${chunkZ}`, type: types[Math.floor(roll * 1000) % types.length], chunkX, chunkZ};
}

export function addStructure(chunks, seed, structure) {
    if (!structure) return chunks;
    const centerX = structure.chunkX * 16 + 8;
    const centerZ = structure.chunkZ * 16 + 8;
    const y = surfaceHeight(structure.dimensionSeed ?? seed, centerX, centerZ);
    if (hasLakeWater(structure.dimensionSeed ?? seed, centerX, centerZ, y)) return chunks;
    let next = chunks;
    if (structure.type === "crystal_garden") {
        for (let dx = -2; dx <= 2; dx += 2) for (let dz = -2; dz <= 2; dz += 2) {
            const height = 1 + (Math.abs(dx + dz) % 3);
            for (let dy = 1; dy <= height; dy += 1) next = setBlock(next, [centerX + dx, y + dy, centerZ + dz], "crystal_block");
        }
        return next;
    }
    if (structure.type === "well") {
        for (let dx = -2; dx <= 2; dx += 1) for (let dz = -2; dz <= 2; dz += 1) {
            if (Math.abs(dx) === 2 || Math.abs(dz) === 2) next = setBlock(next, [centerX + dx, y + 1, centerZ + dz], "stone");
        }
        next = setBlock(next, [centerX, y + 1, centerZ], "water");
        return next;
    }
    const material = structure.type === "camp" ? "wood" : "stone";
    for (let dx = -3; dx <= 3; dx += 1) for (let dz = -3; dz <= 3; dz += 1) {
        if (Math.abs(dx) === 3 || Math.abs(dz) === 3) next = setBlock(next, [centerX + dx, y + 1, centerZ + dz], material);
    }
    for (let dy = 2; dy <= 3; dy += 1) {
        next = setBlock(next, [centerX - 3, y + dy, centerZ - 3], material);
        next = setBlock(next, [centerX + 3, y + dy, centerZ + 3], material);
    }
    return next;
}
