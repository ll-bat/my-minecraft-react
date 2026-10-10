import {fluidMovement} from "./playerPhysics";

const direction = {x: 4, z: -2};

describe("fluid player movement", () => {
    test("slows horizontal movement and falling in water", () => {
        expect(fluidMovement(direction, -8, {}, "water")).toEqual([2.2, -1.25, -1.1]);
    });

    test("supports swimming upward and downward", () => {
        expect(fluidMovement(direction, 0, {jump: true}, "water")[1]).toBe(2.4);
        expect(fluidMovement(direction, 0, {swimDown: true}, "water")[1]).toBe(-2);
    });

    test("moves more slowly in lava and ignores non-fluid blocks", () => {
        expect(fluidMovement(direction, 0, {}, "lava")).toEqual([1.4, 0, -0.7]);
        expect(fluidMovement(direction, 0, {}, "stone")).toBeNull();
    });
});
