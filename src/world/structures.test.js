import {addStructure, structureForColumn} from "./structures";

describe("seeded structures", () => {
    test("placement decisions are deterministic", () => {
        expect(structureForColumn("same", 12, -8)).toEqual(structureForColumn("same", 12, -8));
    });

    test("builds a deterministic well", () => {
        const structure = {id: "well", type: "well", chunkX: 3, chunkZ: 3};
        const chunks = addStructure(new Map(), "structures", structure);
        expect(Array.from(chunks.values()).some((chunk) => Array.from(chunk.values()).includes("water"))).toBe(true);
    });
});
