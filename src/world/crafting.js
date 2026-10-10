const shaped = (id, pattern, itemId, count = 1) => ({id, type: "shaped", pattern, result: {itemId, count}});

export const CRAFTING_RECIPES = [
    {id: "planks", type: "shapeless", ingredients: ["log"], result: {itemId: "wood", count: 4}},
    shaped("sticks", [["wood"], ["wood"]], "stick", 4),
    shaped("crafting_table", [["wood", "wood"], ["wood", "wood"]], "crafting_table"),
    shaped("furnace", [["stone", "stone", "stone"], ["stone", null, "stone"], ["stone", "stone", "stone"]], "furnace"),
    shaped("wooden_pickaxe", [["wood", "wood", "wood"], [null, "stick", null], [null, "stick", null]], "wooden_pickaxe"),
    shaped("wooden_axe", [["wood", "wood"], ["wood", "stick"], [null, "stick"]], "wooden_axe"),
    shaped("wooden_shovel", [["wood"], ["stick"], ["stick"]], "wooden_shovel"),
    shaped("stone_pickaxe", [["stone", "stone", "stone"], [null, "stick", null], [null, "stick", null]], "stone_pickaxe"),
    shaped("stone_axe", [["stone", "stone"], ["stone", "stick"], [null, "stick"]], "stone_axe"),
    shaped("stone_shovel", [["stone"], ["stick"], ["stick"]], "stone_shovel"),
    shaped("wooden_hoe", [["wood", "wood"], [null, "stick"], [null, "stick"]], "wooden_hoe"),
    shaped("chest", [["wood", "wood", "wood"], ["wood", null, "wood"], ["wood", "wood", "wood"]], "chest"),
    shaped("door", [["wood", "wood"], ["wood", "wood"], ["wood", "wood"]], "door"),
    shaped("framed_windows", [["wood", "wood", "wood"], ["wood", "glass", "wood"], ["wood", "wood", "wood"]], "window", 4),
    shaped("ladder", [["stick", null, "stick"], ["stick", "stick", "stick"], ["stick", null, "stick"]], "ladder", 3),
    shaped("dream_portal", [["crystal", "crystal", "crystal"], ["crystal", "gold_ingot", "crystal"], ["crystal", "crystal", "crystal"]], "portal"),
    shaped("enchanting_table", [[null, "crystal", null], ["crystal", "obsidian", "crystal"], ["obsidian", "obsidian", "obsidian"]], "enchanting_table"),
];

function occupiedBounds(grid, size) {
    const occupied = grid.map((stack, index) => stack ? [index % size, Math.floor(index / size)] : null).filter(Boolean);
    if (!occupied.length) return null;
    const xs = occupied.map(([x]) => x);
    const ys = occupied.map(([, y]) => y);
    return {minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys)};
}

function matchShaped(recipe, grid, size) {
    const bounds = occupiedBounds(grid, size);
    if (!bounds) return null;
    const height = recipe.pattern.length;
    const width = Math.max(...recipe.pattern.map((row) => row.length));
    if (bounds.maxX - bounds.minX + 1 !== width || bounds.maxY - bounds.minY + 1 !== height) return null;
    const indexes = [];
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const expected = recipe.pattern[y]?.[x] ?? null;
            const index = (bounds.minY + y) * size + bounds.minX + x;
            if ((grid[index]?.itemId ?? null) !== expected) return null;
            if (expected) indexes.push(index);
        }
    }
    return indexes;
}

function matchShapeless(recipe, grid) {
    const expected = [...recipe.ingredients].sort();
    const actual = grid.filter(Boolean).map((stack) => stack.itemId).sort();
    if (expected.length !== actual.length || expected.some((item, index) => item !== actual[index])) return null;
    return grid.map((stack, index) => stack ? index : null).filter((index) => index !== null);
}

export function findCraftingRecipe(grid, size) {
    for (const recipe of CRAFTING_RECIPES) {
        const indexes = recipe.type === "shaped" ? matchShaped(recipe, grid, size) : matchShapeless(recipe, grid);
        if (indexes) return {...recipe, ingredientIndexes: indexes};
    }
    return null;
}

export function consumeRecipe(grid, recipe) {
    const next = grid.map((stack) => stack ? {...stack} : null);
    recipe.ingredientIndexes.forEach((index) => {
        next[index] = next[index].count === 1 ? null : {...next[index], count: next[index].count - 1};
    });
    return next;
}
