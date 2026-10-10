import {ITEM_BY_ID} from "./items";

export const SMELTING_RECIPES = {
    iron_ore: {itemId: "iron_ingot", count: 1},
    sand: {itemId: "glass", count: 1},
    copper_ore: {itemId: "copper_ingot", count: 1},
    gold_ore: {itemId: "gold_ingot", count: 1},
};

export const FUEL_TIME = {coal: 40000, log: 10000, wood: 10000};
export const SMELT_TIME = 5000;

export function createFurnace(now = Date.now()) {
    return {type: "furnace", input: null, fuel: null, output: null, burnRemaining: 0, cookProgress: 0, lastUpdated: now};
}

function canOutput(furnace, result) {
    return !furnace.output || (
        furnace.output.itemId === result.itemId
        && furnace.output.count + result.count <= ITEM_BY_ID[result.itemId].maxStack
    );
}

export function advanceFurnace(value, now = Date.now()) {
    const furnace = {...value, input: value.input && {...value.input}, fuel: value.fuel && {...value.fuel}, output: value.output && {...value.output}};
    let elapsed = Math.max(0, Math.min(now - furnace.lastUpdated, 60000));
    furnace.lastUpdated = now;
    const recipe = furnace.input ? SMELTING_RECIPES[furnace.input.itemId] : null;
    if (!recipe || !canOutput(furnace, recipe)) {
        furnace.cookProgress = 0;
        return furnace;
    }

    while (elapsed > 0) {
        if (furnace.burnRemaining <= 0) {
            const fuelTime = furnace.fuel ? FUEL_TIME[furnace.fuel.itemId] : 0;
            if (!fuelTime) break;
            furnace.burnRemaining = fuelTime;
            furnace.fuel = furnace.fuel.count === 1 ? null : {...furnace.fuel, count: furnace.fuel.count - 1};
        }
        const step = Math.min(elapsed, furnace.burnRemaining, SMELT_TIME - furnace.cookProgress);
        elapsed -= step;
        furnace.burnRemaining -= step;
        furnace.cookProgress += step;
        if (furnace.cookProgress >= SMELT_TIME) {
            furnace.cookProgress = 0;
            furnace.input = furnace.input.count === 1 ? null : {...furnace.input, count: furnace.input.count - 1};
            furnace.output = furnace.output
                ? {...furnace.output, count: furnace.output.count + recipe.count}
                : {...recipe};
            const nextRecipe = furnace.input ? SMELTING_RECIPES[furnace.input.itemId] : null;
            if (!nextRecipe || !canOutput(furnace, nextRecipe)) break;
        }
    }
    return furnace;
}
