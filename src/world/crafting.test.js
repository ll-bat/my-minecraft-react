import {consumeRecipe, findCraftingRecipe} from "./crafting";

const stack = (itemId, count = 1) => ({itemId, count});

describe("crafting", () => {
    test("matches shapeless planks in a 2 by 2 grid", () => {
        const grid = [null, stack("log"), null, null];
        const recipe = findCraftingRecipe(grid, 2);
        expect(recipe.result).toEqual({itemId: "wood", count: 4});
        expect(consumeRecipe(grid, recipe)).toEqual([null, null, null, null]);
    });

    test("matches a shifted shaped recipe", () => {
        const grid = [null, stack("wood"), null, null, stack("wood"), null, null, null, null];
        expect(findCraftingRecipe(grid, 3).result).toEqual({itemId: "stick", count: 4});
    });

    test("requires the 3 by 3 table for pickaxes", () => {
        const grid = [stack("wood"), stack("wood"), stack("wood"), null, stack("stick"), null, null, stack("stick"), null];
        expect(findCraftingRecipe(grid, 2)).toBeNull();
        expect(findCraftingRecipe(grid, 3).result.itemId).toBe("wooden_pickaxe");
    });
});
