import {itemCategory, itemsInCategory} from "./items";

describe("creative item categories", () => {
    test("separates utility blocks, tools, and friendly creatures", () => {
        expect(itemCategory({blockId: "bed"})).toBe("utility");
        expect(itemsInCategory("tools").some((item) => item.id === "wooden_pickaxe")).toBe(true);
        expect(itemsInCategory("creatures").map((item) => item.creatureType)).toEqual(["sheep", "rabbit", "glow_sprite"]);
        expect(itemsInCategory("windows").map((item) => item.id)).toEqual(["window"]);
        expect(itemsInCategory("doors").map((item) => item.id)).toEqual(["door"]);
    });
});
