import {setBlock} from "./chunks";
import {lightAt, rebuildBlockLight, skyLightAt, updateBlockLight} from "./lighting";

const sortedLevels = (levels) => Array.from(levels).sort(([left], [right]) => left.localeCompare(right));

describe("voxel lighting", () => {
    test("propagates emitted light across a chunk boundary", () => {
        const chunks = setBlock(new Map(), [15, 4, 0], "torch");
        const levels = rebuildBlockLight(chunks);
        expect(levels.get("15,4,0")).toBe(14);
        expect(levels.get("16,4,0")).toBe(13);
    });

    test("blocks skylight below an opaque voxel", () => {
        const chunks = setBlock(new Map(), [2, 8, 2], "stone");
        expect(skyLightAt(chunks, [2, 7, 2])).toBe(0);
        expect(lightAt(chunks, new Map(), [3, 7, 2])).toBe(15);
    });

    test("incrementally matches a full rebuild when blocks obstruct and reveal light", () => {
        let chunks = setBlock(new Map(), [0, 4, 0], "torch");
        const original = rebuildBlockLight(chunks);
        const originalSnapshot = sortedLevels(original);
        chunks = setBlock(chunks, [2, 4, 0], "stone");
        const obstructed = updateBlockLight(chunks, original, [[2, 4, 0]]);
        expect(sortedLevels(obstructed)).toEqual(sortedLevels(rebuildBlockLight(chunks)));
        expect(sortedLevels(original)).toEqual(originalSnapshot);

        chunks = setBlock(chunks, [2, 4, 0], null);
        const revealed = updateBlockLight(chunks, obstructed, [[2, 4, 0]]);
        expect(sortedLevels(revealed)).toEqual(sortedLevels(rebuildBlockLight(chunks)));
    });

    test("incrementally adds a distant source without disturbing existing light", () => {
        let chunks = setBlock(new Map(), [0, 4, 0], "torch");
        const original = rebuildBlockLight(chunks);
        chunks = setBlock(chunks, [40, 4, 0], "lantern");
        const updated = updateBlockLight(chunks, original, [[40, 4, 0]]);
        expect(sortedLevels(updated)).toEqual(sortedLevels(rebuildBlockLight(chunks)));
    });
});
