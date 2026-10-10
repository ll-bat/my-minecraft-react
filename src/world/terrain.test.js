import {BIOMES, biomeAt, generateChunkColumn, hasLakeWater, SEA_LEVEL, spawnPosition, surfaceHeight, WORLD_MIN_Y} from "./terrain";
import {getBlock} from "./chunks";

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

    test("finds a spawn position above the terrain", () => {
        const seed = "spawn";
        const [x, y, z] = spawnPosition(seed);
        expect(y).toBe(surfaceHeight(seed, x, z) + 2);
        expect(hasLakeWater(seed, x, z)).toBe(false);
    });

    test("generates sparse local lakes instead of filling every lowland", () => {
        const seed = "localized-lakes";
        let lakeColumns = 0;
        let dryLowlands = 0;
        let lakePosition = null;
        let dryPosition = null;

        for (let x = -96; x <= 96; x += 1) {
            for (let z = -96; z <= 96; z += 1) {
                if (surfaceHeight(seed, x, z) >= SEA_LEVEL) continue;
                if (hasLakeWater(seed, x, z)) {
                    lakeColumns += 1;
                    lakePosition ??= [x, z];
                } else {
                    dryLowlands += 1;
                    dryPosition ??= [x, z];
                }
            }
        }

        expect(lakeColumns).toBeGreaterThan(0);
        expect(dryLowlands).toBeGreaterThan(lakeColumns * 2);

        const blockAtWaterLevel = ([x, z]) => {
            const chunks = generateChunkColumn(seed, Math.floor(x / 16), Math.floor(z / 16));
            return getBlock(chunks, [x, SEA_LEVEL, z]);
        };
        expect(blockAtWaterLevel(lakePosition)).toBe("water");
        expect(blockAtWaterLevel(dryPosition)).not.toBe("water");
    });

    test("keeps the default starting region mostly dry while retaining visible water", () => {
        let waterColumns = 0;
        const diameter = 65;
        for (let x = -32; x <= 32; x += 1) {
            for (let z = -32; z <= 32; z += 1) {
                if (hasLakeWater("minecraft-react", x, z)) waterColumns += 1;
            }
        }
        expect(waterColumns).toBeGreaterThan(20);
        expect(waterColumns).toBeLessThan(diameter * diameter * 0.15);
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
