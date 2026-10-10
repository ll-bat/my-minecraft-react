import {setBlock} from "./chunks";
import {lightAt, rebuildBlockLight, skyLightAt} from "./lighting";

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
});
