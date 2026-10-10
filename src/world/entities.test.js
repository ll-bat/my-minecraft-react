import {creatureGroundY, interactWithCreature, isNightTime, spawnCreaturesForColumn, updateCreature} from "./entities";
import {surfaceHeight} from "./terrain";
import {setBlock} from "./chunks";

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
});
