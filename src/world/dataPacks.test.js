import {registerDataPack, validateDataPack} from "./dataPacks";
import {BLOCK_BY_ID} from "./blocks";

describe("data packs", () => {
    test("rejects unsafe identifiers and colors", () => {
        const result = validateDataPack({version: 1, namespace: "Bad ID", blocks: [{id: "x", name: "X", color: "blue"}]});
        expect(result.ok).toBe(false);
    });

    test("registers a namespaced custom block", () => {
        const result = registerDataPack({version: 1, namespace: "testpack", blocks: [{id: "blue_brick", name: "Blue Brick", color: "#3377bb"}]});
        expect(result.ok).toBe(true);
        expect(BLOCK_BY_ID["testpack:blue_brick"].custom).toBe(true);
    });
});
