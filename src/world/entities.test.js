import {creatureGroundY, interactWithCreature, isNightTime, spawnCommunityForStructure, spawnCreaturesForColumn, spawnFishForColumn, updateCreature} from "./entities";
import {surfaceHeight} from "./terrain";
import {getBlock, setBlock} from "./chunks";

const creature = {
    id: "sheep:test", type: "sheep", position: [0, 8, 0], velocity: [0, 0, 0], health: 10,
    animationState: "idle", heading: 0, friendLevel: 1, followUntil: 10000,
    lastInteraction: 0, lastGift: 0, persistent: true, chunk: [0, 0],
};

describe("friendly creatures", () => {
    test("spawns deterministically on dry terrain away from the player", () => {
        const first = spawnCreaturesForColumn("friends", 2, 2, [0, 0, 0]);
        const second = spawnCreaturesForColumn("friends", 2, 2, [0, 0, 0]);
        expect(second).toEqual(first);
        first.forEach((entity) => expect(Math.hypot(entity.position[0], entity.position[2])).toBeGreaterThanOrEqual(9));
    });

    test("creates named peaceful residents with professions, tasks, trades, and village transport", () => {
        const structure = {id: "overworld:4,4", type: "village", chunkX: 4, chunkZ: 4};
        const first = spawnCommunityForStructure("friends", structure, new Map());
        const second = spawnCommunityForStructure("friends", structure, new Map());
        expect(second).toEqual(first);
        expect(first.filter((entity) => entity.type === "villager")).toHaveLength(5);
        expect(first.find((entity) => entity.type === "villager")).toMatchObject({
            name: expect.any(String), profession: expect.any(String), task: expect.any(Object), trade: expect.any(Object), persistent: true,
        });
        expect(first.some((entity) => entity.type === "horse")).toBe(true);
        expect(first.some((entity) => entity.type === "minecart")).toBe(true);
    });

    test("gives residents in separate city districts unique persistent identities", () => {
        const base = {id: "overworld:city:4,4", type: "city", chunkX: 4, chunkZ: 4, baseY: 8};
        const west = spawnCommunityForStructure("friends", {...base, districtX: -1, districtZ: 0}, new Map());
        const center = spawnCommunityForStructure("friends", {...base, districtX: 0, districtZ: 0}, new Map());
        expect(new Set([...west, ...center].map((entity) => entity.id)).size).toBe(west.length + center.length);
    });

    test("spawns colorful fish only inside generated water", () => {
        let chunks = new Map();
        for (let x = 16; x < 32; x += 1) for (let z = 16; z < 32; z += 1) chunks = setBlock(chunks, [x, 4, z], "water");
        const fish = spawnFishForColumn("friends", 1, 1, chunks, [0, 4, 0]);
        expect(fish.length).toBeGreaterThan(0);
        expect(fish.length).toBeLessThanOrEqual(3);
        fish.forEach((entity) => {
            expect(entity.type).toMatch(/^fish_(blue|orange|pink)$/);
            expect(getBlock(chunks, entity.position)).toBe("water");
        });
    });

    test("recognizes nighttime in the shared day cycle", () => {
        expect(isNightTime(0)).toBe(false);
        expect(isNightTime(180)).toBe(true);
    });

    test("grounds each creature model by its lowest visible point", () => {
        expect(creatureGroundY("sheep", 8)).toBeCloseTo(8.775);
        expect(creatureGroundY("rabbit", 8)).toBeCloseTo(8.425);
        expect(creatureGroundY("glow_sprite", 8)).toBeCloseTo(8.275);
    });

    test("a friend follows while preserving personal space", () => {
        const grounded = {...creature, position: [0, creatureGroundY("sheep", surfaceHeight("friends", 0, 0)), 0]};
        const state = {seed: "friends", chunks: new Map(), playerPosition: [8, grounded.position[1], 0]};
        const moved = updateCreature(grounded, state, 1000, 1);
        expect(moved.position[0]).toBeGreaterThan(grounded.position[0]);
        const nearby = updateCreature({...grounded, position: [7, creatureGroundY("sheep", surfaceHeight("friends", 7, 0)), 0]}, state, 1000, 1);
        expect(nearby.velocity).toEqual([0, 0, 0]);
    });

    test("petting creates friendship and gifts without damage", () => {
        const result = interactWithCreature({...creature, friendLevel: 0}, 1000);
        expect(result.entity.friendLevel).toBe(1);
        expect(result.entity.health).toBe(10);
        expect(result.gift).toBe("flower");
        expect(interactWithCreature(result.entity, 1200).changed).toBe(false);
    });

    test("friends stop instead of walking into fluid obstacles", () => {
        const y = creatureGroundY("sheep", surfaceHeight("friends", 0, 0));
        const waterY = surfaceHeight("friends", 1, 0) + 1;
        const state = {
            seed: "friends",
            chunks: setBlock(new Map(), [1, waterY, 0], "water"),
            playerPosition: [8, y, 0],
        };
        const result = updateCreature({...creature, position: [0, y, 0]}, state, 1000, 1);
        expect(result.velocity).toEqual([0, 0, 0]);
        expect(result.position[0]).toBe(0);
    });

    test.each([
        ["boat", 16],
        ["ship", 32],
    ])("%s floats at the highest water surface instead of sinking to terrain", (type, health) => {
        let chunks = setBlock(new Map(), [0, 3, 0], "water");
        chunks = setBlock(chunks, [0, 4, 0], "water");
        const boat = {
            ...creature, id: `${type}:test`, type, health,
            position: [0, 1.5, 0], friendLevel: 1,
        };
        const result = updateCreature(boat, {seed: "friends", chunks, playerPosition: [0, 2, 1]}, 2000, 1);
        expect(result.position).toEqual([0, 4.5, 0]);
        expect(result.velocity).toEqual([0, 0, 0]);
    });
});
