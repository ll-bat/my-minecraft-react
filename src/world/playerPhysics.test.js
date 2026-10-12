import {
    collisionColumnReady,
    fluidMovement,
    playerRecoveryPosition,
    playerResumePosition,
    supportCollisionToken,
    watercraftRiderHeight
} from "./playerPhysics";
import {getBlock, setBlock} from "./chunks";

const direction = {x: 4, z: -2};

describe("fluid player movement", () => {
    test("slows horizontal movement and falling in water", () => {
        expect(fluidMovement(direction, -8, {}, "water")).toEqual([2.2, -1.25, -1.1]);
    });

    test("supports swimming upward and downward", () => {
        expect(fluidMovement(direction, 0, {jump: true}, "water")[1]).toBe(2.4);
        expect(fluidMovement(direction, 0, {swimDown: true}, "water")[1]).toBe(-2);
    });

    test("moves more slowly in lava and ignores non-fluid blocks", () => {
        expect(fluidMovement(direction, 0, {}, "lava")).toEqual([1.4, 0, -0.7]);
        expect(fluidMovement(direction, 0, {}, "stone")).toBeNull();
    });
});

describe("watercraft riding", () => {
    test("keeps the rider at one stable deck height", () => {
        expect(watercraftRiderHeight(4, {groundOffset: 0.5, riderOffset: 0.8})).toBe(5.3);
        expect(watercraftRiderHeight(4, {groundOffset: 0.5, riderOffset: 1.55})).toBe(6.05);
    });
});

describe("player startup position", () => {
    test("resumes at the persisted position instead of world spawn", () => {
        expect(playerResumePosition({
            playerPosition: [82.5, 21, -47.25],
            spawn: [0, 18, 0],
        })).toEqual([82.5, 21, -47.25]);
    });

    test("uses spawn only when no valid saved position exists", () => {
        expect(playerResumePosition({playerPosition: null, spawn: [3, 19, 4]})).toEqual([3, 19, 4]);
    });

    test("identifies the collision chunk supporting the player", () => {
        const chunks = setBlock(new Map(), [17, 15, -1], "stone");
        const state = {worldId: 7, getBlock: (position) => getBlock(chunks, position)};
        expect(supportCollisionToken(state, [17, 16, -1])).toBe("7:1,0,-1");
        expect(supportCollisionToken(state, [18, 16, -1])).toBeNull();
    });

    test("waits for a nearby collision body in the player's column", () => {
        const state = {worldId: 4, collisionReadyChunkKeys: new Set(["4:2,1,-3", "3:2,2,-3"])};
        expect(collisionColumnReady(state, [33, 35, -40])).toBe(true);
        expect(collisionColumnReady(state, [49, 35, -40])).toBe(false);
    });

    test("recovers a player saved beneath the terrain to its top surface", () => {
        let chunks = new Map();
        for (let y = -16; y <= 6; y += 1) chunks = setBlock(chunks, [4, y, -2], y === -16 ? "bedrock" : "stone");
        const state = {
            spawn: [0, 20, 0],
            getBlock: (position) => getBlock(chunks, position),
        };
        expect(playerRecoveryPosition(state, [4.25, -30, -2.25])).toEqual([4.25, 8, -2.25]);
        expect(playerRecoveryPosition(state, [4.25, 8, -2.25])).toBeNull();
    });

    test("recovers an invalid position embedded inside solid terrain", () => {
        const chunks = setBlock(new Map(), [1, 3, 1], "stone");
        const state = {spawn: [0, 20, 0], getBlock: (position) => getBlock(chunks, position)};
        expect(playerRecoveryPosition(state, [1, 3, 1])).toEqual([1, 5, 1]);
    });
});
