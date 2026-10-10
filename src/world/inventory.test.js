import {addItem, catalogInventory, consumeItem, creativeInventory, emptyInventory, interactSlot, shiftMove, transferStack} from "./inventory";

describe("inventory", () => {
    test("merges items before creating another stack", () => {
        const inventory = emptyInventory();
        inventory[0] = {itemId: "dirt", count: 63};
        const result = addItem(inventory, "dirt", 3);
        expect(result.slots[0]).toEqual({itemId: "dirt", count: 64});
        expect(result.slots[1]).toEqual({itemId: "dirt", count: 2});
        expect(result.remainder).toBe(0);
    });

    test("consumes a stack without mutating the source", () => {
        const inventory = emptyInventory();
        inventory[0] = {itemId: "stone", count: 2};
        const next = consumeItem(inventory, 0);
        expect(next[0].count).toBe(1);
        expect(inventory[0].count).toBe(2);
    });

    test("merges, swaps, and shift-moves stacks", () => {
        const inventory = emptyInventory();
        inventory[0] = {itemId: "dirt", count: 10};
        inventory[1] = {itemId: "dirt", count: 60};
        let next = transferStack(inventory, 0, 1);
        expect(next[1].count).toBe(64);
        expect(next[0].count).toBe(6);
        next = shiftMove(next, 0);
        expect(next[0]).toBeNull();
        expect(next[9]).toEqual({itemId: "dirt", count: 6});
    });

    test("creative inventory exposes the registered catalog", () => {
        const inventory = creativeInventory();
        expect(inventory[0]).toEqual({itemId: "dirt", count: 64});
        expect(inventory.filter(Boolean).length).toBeGreaterThan(7);
    });

    test("catalog inventory fills missing block types and replenishes existing stacks", () => {
        const inventory = emptyInventory();
        inventory[4] = {itemId: "dirt", count: 2};
        const catalog = catalogInventory(inventory);
        expect(catalog[4]).toEqual({itemId: "dirt", count: 64});
        expect(catalog.some((stack) => stack?.itemId === "water")).toBe(true);
        expect(catalog.some((stack) => stack?.itemId === "obsidian")).toBe(true);
    });

    test("splits a stack and places held items one at a time", () => {
        const inventory = emptyInventory();
        inventory[0] = {itemId: "dirt", count: 5};
        const pickedUp = interactSlot(inventory, 0, null, true);
        expect(pickedUp.slots[0].count).toBe(2);
        expect(pickedUp.held.count).toBe(3);
        const placed = interactSlot(pickedUp.slots, 1, pickedUp.held, true);
        expect(placed.slots[1].count).toBe(1);
        expect(placed.held.count).toBe(2);
    });
});
