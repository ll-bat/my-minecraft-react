import {getBlock, setBlock} from "./chunks";
import {createChest, facingFromDirection, growCrop, isHydrated, propagateSwitch} from "./interactions";

describe("world interactions", () => {
    test("creates a revisioned 27-slot chest", () => {
        const chest = createChest();
        expect(chest.slots).toHaveLength(27);
        expect(chest.revision).toBe(0);
    });

    test("derives cardinal placement orientation", () => {
        expect(facingFromDirection([0.9, 0, 0.1])).toBe("east");
        expect(facingFromDirection([0.1, 0, -0.9])).toBe("north");
    });

    test("hydrates and advances a crop beside water", () => {
        let chunks = setBlock(new Map(), [0, 1, 0], "farmland");
        chunks = setBlock(chunks, [3, 1, 0], "water");
        chunks = setBlock(chunks, [0, 2, 0], "crop_0");
        expect(isHydrated(chunks, [0, 1, 0])).toBe(true);
        const result = growCrop(chunks, [0, 2, 0]);
        expect(result.changed).toBe(true);
        expect(getBlock(result.chunks, [0, 2, 0])).toBe("crop_1");
    });

    test("powers adjacent lamps", () => {
        let chunks = setBlock(new Map(), [0, 1, 0], "switch");
        chunks = setBlock(chunks, [1, 1, 0], "lamp");
        const result = propagateSwitch(chunks, [0, 1, 0], true);
        expect(getBlock(result.chunks, [1, 1, 0])).toBe("lamp_on");
    });
});
