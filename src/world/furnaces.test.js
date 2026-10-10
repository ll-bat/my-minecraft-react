import {advanceFurnace, createFurnace, SMELT_TIME} from "./furnaces";

describe("furnaces", () => {
    test("consumes fuel and smelts iron ore", () => {
        const furnace = {...createFurnace(100), input: {itemId: "iron_ore", count: 1}, fuel: {itemId: "coal", count: 1}};
        const result = advanceFurnace(furnace, 100 + SMELT_TIME);
        expect(result.input).toBeNull();
        expect(result.fuel).toBeNull();
        expect(result.output).toEqual({itemId: "iron_ingot", count: 1});
        expect(result.burnRemaining).toBeGreaterThan(0);
    });

    test("does not process without valid fuel", () => {
        const furnace = {...createFurnace(0), input: {itemId: "sand", count: 1}};
        expect(advanceFurnace(furnace, SMELT_TIME).output).toBeNull();
    });
});
