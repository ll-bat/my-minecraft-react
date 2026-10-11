import {ITEM_BY_ID, itemCategory, itemsInCategory} from "./items";

describe("creative item categories", () => {
    test("separates utility blocks, tools, and friendly creatures", () => {
        expect(itemCategory({blockId: "bed"})).toBe("utility");
        expect(itemsInCategory("tools").some((item) => item.id === "wooden_pickaxe")).toBe(true);
        expect(itemsInCategory("creatures").map((item) => item.creatureType)).toEqual(["sheep", "rabbit", "glow_sprite"]);
        expect(itemsInCategory("windows").map((item) => item.id)).toEqual(["window"]);
        expect(itemsInCategory("doors").map((item) => item.id)).toEqual(["door"]);
        expect(itemsInCategory("blocks").some((item) => item.id === "red_brick")).toBe(true);
        expect(itemsInCategory("nature").some((item) => item.id === "cactus")).toBe(true);
        expect(itemsInCategory("fluids").map((item) => item.id)).toEqual(["water", "lava"]);
        expect(itemsInCategory("furniture").some((item) => item.id === "chair")).toBe(true);
        expect(itemsInCategory("decor").some((item) => item.id === "flowerpot")).toBe(true);
        expect(itemsInCategory("outdoor").some((item) => item.id === "bench")).toBe(true);
    });


    test("non-block items have matching atlas artwork", () => {
        ["stick", "coal", "iron_ingot", "crystal", "wooden_pickaxe", "stone_axe", "seeds", "wheat", "spawn_sheep"].forEach((id) => {
            expect(ITEM_BY_ID[id].artwork).toMatchObject({size: 128});
            expect(ITEM_BY_ID[id].artwork.atlasSize).toHaveLength(2);
        });
    });
});
