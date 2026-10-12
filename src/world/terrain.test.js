import {
    BIOMES,
    biomeAt,
    elevatedTerrainAt,
    generateChunkColumn,
    hasLakeWater,
    hasNaturalWater,
    riverAt,
    riverPlanForCell,
    SEA_LEVEL,
    spawnPosition,
    surfaceHeight,
    terrainAt,
    upgradeNaturalWaterColumn,
    WORLD_MIN_Y
} from "./terrain";
import {getBlock, setBlock} from "./chunks";

describe("seeded terrain", () => {
    test("is deterministic for the same seed", () => {
        expect(surfaceHeight("same seed", 31, -22)).toBe(surfaceHeight("same seed", 31, -22));
        expect(biomeAt("same seed", 31, -22)).toBe(biomeAt("same seed", 31, -22));
    });

    test("selects only supported biomes", () => {
        const supported = Object.values(BIOMES);
        const discovered = new Set();
        for (let coordinate = -200; coordinate <= 200; coordinate += 25) {
            const biome = biomeAt("biomes", coordinate, coordinate / 2);
            expect(supported).toContain(biome);
            discovered.add(biome);
        }
        for (let x = -800; x <= 800; x += 80) {
            for (let z = -800; z <= 800; z += 80) {
                discovered.add(biomeAt("biomes", x, z));
            }
        }
        expect(discovered).toEqual(new Set(supported));
    });

    test("generates bedrock and a solid surface layer", () => {
        const seed = "layers";
        const chunks = generateChunkColumn(seed, 0, 0);
        const height = surfaceHeight(seed, 3, 4);

        expect(getBlock(chunks, [3, WORLD_MIN_Y, 4])).toBe("bedrock");
        expect(getBlock(chunks, [3, height, 4])).not.toBeNull();
        expect(getBlock(chunks, [3, height + 10, 4])).toBeNull();
    });

    test("creates terraced forest and mountain highlands capped at height fifty", () => {
        const seed = "terraced-highlands";
        const examples = new Map();
        for (let x = -720; x <= 720; x += 32) {
            for (let z = -720; z <= 720; z += 32) {
                const elevated = elevatedTerrainAt(seed, x, z);
                if (elevated && !examples.has(elevated.biome)) examples.set(elevated.biome, elevated);
            }
        }

        expect(examples.has(BIOMES.FOREST)).toBe(true);
        expect(examples.has(BIOMES.MOUNTAINS)).toBe(true);
        examples.forEach((elevated) => {
            const centerX = Math.round(elevated.centerX);
            const centerZ = Math.round(elevated.centerZ);
            expect(surfaceHeight(seed, centerX, centerZ)).toBeGreaterThanOrEqual(40);
            expect(surfaceHeight(seed, centerX, centerZ)).toBeLessThanOrEqual(50);
            expect(biomeAt(seed, centerX, centerZ)).toBe(elevated.biome);

            let comparedSteps = 0;
            for (let distance = 0; distance < Math.floor(elevated.radius * 0.75); distance += 1) {
                const current = elevatedTerrainAt(seed, Math.round(elevated.centerX + distance), centerZ);
                const outward = elevatedTerrainAt(seed, Math.round(elevated.centerX + distance + 1), centerZ);
                if (current?.centerX !== elevated.centerX || current?.centerZ !== elevated.centerZ
                    || outward?.centerX !== elevated.centerX || outward?.centerZ !== elevated.centerZ) continue;
                expect(Math.abs(current.rise - outward.rise)).toBeLessThanOrEqual(1);
                const currentHeight = terrainAt(seed, Math.round(elevated.centerX + distance), centerZ).baseSurface;
                const outwardHeight = terrainAt(seed, Math.round(elevated.centerX + distance + 1), centerZ).baseSurface;
                expect(Math.abs(currentHeight - outwardHeight)).toBeLessThanOrEqual(1);
                comparedSteps += 1;
            }
            expect(comparedSteps).toBeGreaterThan(20);
        });
    });

    test("finds a spawn position above the terrain", () => {
        const seed = "spawn";
        const [x, y, z] = spawnPosition(seed);
        expect(y).toBe(surfaceHeight(seed, x, z) + 2);
        expect(hasNaturalWater(seed, x, z)).toBe(false);
    });

    test("carves moderately wide finite rivers whose ends exceed the maximum view diameter", () => {
        const seed = "finite-rivers";
        const plan = riverPlanForCell(seed, 0, 0);
        expect(plan.length).toBeGreaterThanOrEqual(310);
        expect(plan.length).toBeLessThanOrEqual(330);
        expect(plan.width).toBeGreaterThanOrEqual(7);
        expect(plan.width).toBeLessThanOrEqual(10.5);
        plan.waterLevels.slice(1).forEach((level, index) => {
            expect(level).toBeLessThanOrEqual(plan.waterLevels[index]);
        });

        const beforeStart = [
            plan.points[0].x + (plan.points[0].x - plan.points[1].x) * 2,
            plan.points[0].z + (plan.points[0].z - plan.points[1].z) * 2,
        ];
        const end = plan.points[plan.points.length - 1];
        const beforeEnd = plan.points[plan.points.length - 2];
        const afterEnd = [
            end.x + (end.x - beforeEnd.x) * 2,
            end.z + (end.z - beforeEnd.z) * 2,
        ];
        expect(riverAt(seed, ...beforeStart)).toBeNull();
        expect(riverAt(seed, ...afterEnd)).toBeNull();

        const midpoint = plan.points[Math.floor(plan.points.length / 2)];
        let waterColumn = null;
        for (let dx = -3; dx <= 3 && !waterColumn; dx += 1) for (let dz = -3; dz <= 3; dz += 1) {
            const x = Math.round(midpoint.x + dx);
            const z = Math.round(midpoint.z + dz);
            if (riverAt(seed, x, z)) {
                waterColumn = [x, z];
                break;
            }
        }
        expect(waterColumn).not.toBeNull();
        const [x, z] = waterColumn;
        const terrain = terrainAt(seed, x, z);
        expect(terrain.baseSurface - terrain.surface).toBeGreaterThanOrEqual(1);
        const chunks = generateChunkColumn(seed, Math.floor(x / 16), Math.floor(z / 16));
        expect(getBlock(chunks, [x, terrain.surface + 1, z])).toBe("water");
        expect(getBlock(chunks, [x, terrain.river.waterLevel, z])).toBe("water");

        let cutPoint = null;
        plan.points.slice(1, -1).forEach((point) => {
            const channel = terrainAt(seed, Math.round(point.x), Math.round(point.z));
            if (!channel.river || channel.baseSurface <= channel.river.waterLevel) return;
            cutPoint ??= [Math.round(point.x), Math.round(point.z), channel];
            expect(channel.surface).toBe(channel.river.waterLevel - channel.river.depth);
        });
        expect(cutPoint).not.toBeNull();

        const [cutX, cutZ, cutTerrain] = cutPoint;
        const cutChunkX = Math.floor(cutX / 16);
        const cutChunkZ = Math.floor(cutZ / 16);
        let legacyChunks = generateChunkColumn(seed, cutChunkX, cutChunkZ);
        legacyChunks = setBlock(legacyChunks, [cutX, cutTerrain.river.waterLevel + 1, cutZ], "water");
        const upgraded = upgradeNaturalWaterColumn(legacyChunks, seed, cutChunkX, cutChunkZ);
        expect(getBlock(upgraded, [cutX, cutTerrain.river.waterLevel + 1, cutZ])).toBeNull();

        const spawn = spawnPosition(seed);
        let visibleFromSpawn = false;
        for (let dx = -32; dx <= 32 && !visibleFromSpawn; dx += 1) {
            for (let dz = -32; dz <= 32; dz += 1) {
                if (riverAt(seed, spawn[0] + dx, spawn[2] + dz)) {
                    visibleFromSpawn = true;
                    break;
                }
            }
        }
        expect(visibleFromSpawn).toBe(true);
    });

    test("does not generate water in legacy lake locations", () => {
        const seed = "localized-lakes";
        let lakePosition = null;

        for (let x = -96; x <= 96 && !lakePosition; x += 1) {
            for (let z = -96; z <= 96; z += 1) {
                if (surfaceHeight(seed, x, z) >= SEA_LEVEL) continue;
                if (hasLakeWater(seed, x, z) && !riverAt(seed, x, z)) {
                    lakePosition = [x, z];
                    break;
                }
            }
        }

        expect(lakePosition).not.toBeNull();
        const [x, z] = lakePosition;
        const chunkX = Math.floor(x / 16);
        const chunkZ = Math.floor(z / 16);
        const chunks = generateChunkColumn(seed, chunkX, chunkZ);
        expect(getBlock(chunks, [x, SEA_LEVEL, z])).not.toBe("water");

        const legacyChunks = setBlock(chunks, [x, SEA_LEVEL, z], "water");
        const upgraded = upgradeNaturalWaterColumn(legacyChunks, seed, chunkX, chunkZ);
        expect(getBlock(upgraded, [x, SEA_LEVEL, z])).toBeNull();
    });

    test("removes raised legacy ponds while preserving marked player-placed water", () => {
        const seed = "raised-pond-cleanup";
        let position = null;
        for (let x = -32; x <= 32 && !position; x += 1) for (let z = -32; z <= 32; z += 1) {
            const localX = ((x % 16) + 16) % 16;
            if (localX < 15 && !riverAt(seed, x, z) && !riverAt(seed, x + 1, z) && !hasLakeWater(seed, x, z)) {
                position = [x, z];
                break;
            }
        }
        expect(position).not.toBeNull();

        const [x, z] = position;
        const chunkX = Math.floor(x / 16);
        const chunkZ = Math.floor(z / 16);
        let pond = generateChunkColumn(seed, chunkX, chunkZ);
        pond = setBlock(pond, [x, 20, z], "water");
        pond = setBlock(pond, [x + 1, 20, z], "water");

        const cleaned = upgradeNaturalWaterColumn(pond, seed, chunkX, chunkZ);
        expect(getBlock(cleaned, [x, 20, z])).toBeNull();
        expect(getBlock(cleaned, [x + 1, 20, z])).toBeNull();

        const placedFluids = new Map([[`${x},20,${z}`, 0], [`${x + 1},20,${z}`, 0]]);
        const preserved = upgradeNaturalWaterColumn(pond, seed, chunkX, chunkZ, placedFluids);
        expect(getBlock(preserved, [x, 20, z])).toBe("water");
        expect(getBlock(preserved, [x + 1, 20, z])).toBe("water");
    });

    test("generates water only inside river paths", () => {
        const seed = "minecraft-react";
        const generated = new Map();
        for (let x = -32; x <= 32; x += 1) {
            for (let z = -32; z <= 32; z += 1) {
                const key = `${Math.floor(x / 16)},${Math.floor(z / 16)}`;
                if (!generated.has(key)) generated.set(key, generateChunkColumn(seed, Math.floor(x / 16), Math.floor(z / 16)));
                const terrain = terrainAt(seed, x, z);
                for (let y = terrain.surface + 1; y <= Math.max(SEA_LEVEL, terrain.baseSurface); y += 1) {
                    if (getBlock(generated.get(key), [x, y, z]) === "water") expect(riverAt(seed, x, z)).not.toBeNull();
                }
            }
        }
    });

    test("generates caves, ore veins, trees, and vegetation", () => {
        const generatedIds = new Set();
        let caveFound = false;
        for (let seedIndex = 0; seedIndex < 12; seedIndex += 1) {
            const seed = `features-${seedIndex}`;
            const chunks = generateChunkColumn(seed, 0, 0);
            chunks.forEach((chunk) => chunk.forEach((blockId) => generatedIds.add(blockId)));
            for (let x = 0; x < 16 && !caveFound; x += 1) {
                for (let z = 0; z < 16 && !caveFound; z += 1) {
                    const surface = surfaceHeight(seed, x, z);
                    for (let y = WORLD_MIN_Y + 3; y < surface - 4; y += 1) {
                        if (getBlock(chunks, [x, y, z]) === null) {
                            caveFound = true;
                            break;
                        }
                    }
                }
            }
        }

        expect(caveFound).toBe(true);
        expect(generatedIds.has("coal_ore")).toBe(true);
        expect(generatedIds.has("iron_ore")).toBe(true);
        expect(generatedIds.has("log")).toBe(true);
        expect(generatedIds.has("leaves")).toBe(true);
        expect(generatedIds.has("tall_grass") || generatedIds.has("flower")).toBe(true);
    });
});
