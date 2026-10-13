import {damageTool, canHarvest, miningDrop, miningDuration} from "./mining";

describe("mining", () => {
    const woodPick = {itemId: "wooden_pickaxe", count: 1, durability: 30};
    const stonePick = {itemId: "stone_pickaxe", count: 1, durability: 65};

    test("uses matching tools to break blocks faster", () => {
        expect(miningDuration("stone", woodPick)).toBeLessThan(miningDuration("stone", null));
        expect(miningDuration("log", woodPick)).toBe(650);
    });

    test("enforces harvest tiers and maps coal ore to coal", () => {
        expect(canHarvest("iron_ore", woodPick)).toBe(false);
        expect(miningDrop("iron_ore", woodPick)).toBeNull();
        expect(miningDrop("iron_ore", stonePick)).toBe("iron_ore");
        expect(miningDrop("coal_ore", woodPick)).toBe("coal");
    });

    test("damages and renews a tool without clearing its slot", () => {
        expect(damageTool([woodPick], 0)[0].durability).toBe(29);
        expect(damageTool([{...woodPick, durability: 1, wear: 29}], 0)[0]).toEqual({
            ...woodPick,
            durability: 30,
            wear: 0,
        });
    });
});
