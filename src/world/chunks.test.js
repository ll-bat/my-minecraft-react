import {
    affectedChunkKeys,
    chunkCoordinate,
    getBlock,
    indexToLocal,
    localCoordinate,
    locateBlock,
    neighboringChunkKeys,
    setBlock,
    worldPosition
} from "./chunks";

describe("chunk coordinate helpers", () => {
    test.each([
        [0, 0, 0],
        [15, 0, 15],
        [16, 1, 0],
        [-1, -1, 15],
        [-16, -1, 0],
        [-17, -2, 15],
    ])("maps world coordinate %i to chunk %i and local %i", (world, chunk, local) => {
        expect(chunkCoordinate(world)).toBe(chunk);
        expect(localCoordinate(world)).toBe(local);
    });

    test("round-trips a negative world position", () => {
        const location = locateBlock([-17, 31, -1]);
        expect(worldPosition(location.chunk, location.local)).toEqual([-17, 31, -1]);
        expect(indexToLocal(location.index)).toEqual(location.local);
    });

    test("sets, reads, and removes a block without mutating the source map", () => {
        const empty = new Map();
        const added = setBlock(empty, [16, 2, -1], "stone");
        const removed = setBlock(added, [16, 2, -1], null);

        expect(getBlock(empty, [16, 2, -1])).toBeNull();
        expect(getBlock(added, [16, 2, -1])).toBe("stone");
        expect(getBlock(removed, [16, 2, -1])).toBeNull();
    });

    test("marks both chunks when a boundary block changes", () => {
        expect(affectedChunkKeys([15, 4, 2])).toEqual(expect.arrayContaining([
            "0,0,0",
            "1,0,0",
        ]));
    });

    test("lists all neighbors affected when a chunk is generated", () => {
        expect(neighboringChunkKeys("0,0,0")).toHaveLength(7);
        expect(neighboringChunkKeys("0,0,0")).toContain("0,0,-1");
    });
});
