import {
    adjacentPosition,
    blockIntersectsPlayer,
    normalizePosition,
    positionKey
} from "./coordinates";

describe("world coordinate helpers", () => {
    test.each([
        [0, [2, 2, 3]],
        [2, [0, 2, 3]],
        [4, [1, 3, 3]],
        [6, [1, 1, 3]],
        [8, [1, 2, 4]],
        [10, [1, 2, 2]],
    ])("maps face index %i to the adjacent block", (faceIndex, expected) => {
        expect(adjacentPosition([1, 2, 3], faceIndex)).toEqual(expected);
    });

    test("normalizes floating point coordinates to the block grid", () => {
        expect(normalizePosition([1.2, 2.7, -3.6])).toEqual([1, 3, -4]);
        expect(positionKey([1.2, 2.7, -3.6])).toBe("1,3,-4");
    });

    test("detects a block intersecting the player collider", () => {
        expect(blockIntersectsPlayer([0, 1, 0], [0, 1, 0])).toBe(true);
        expect(blockIntersectsPlayer([2, 1, 0], [0, 1, 0])).toBe(false);
    });
});
