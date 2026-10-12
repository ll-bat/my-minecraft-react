import {getBlock, setBlock} from "./chunks";
import {BRIDGE_MAX_LENGTH, planBridge} from "./bridges";

const endpoints = (start = [0, 5, 0], end = [10, 5, 0]) => {
    let chunks = setBlock(new Map(), start, "stone");
    chunks = setBlock(chunks, end, "stone");
    return chunks;
};

describe("bridge planning", () => {
    test("builds a three-wide deck with railings between level endpoints", () => {
        const plan = planBridge(endpoints(), [0, 5, 0], [10, 5, 0], "wood");
        expect(plan.ok).toBe(true);
        expect(plan.length).toBe(10);
        expect(plan.placements.filter((entry) => entry.role === "deck")).toHaveLength(31);
        expect(plan.placements.some((entry) => entry.blockId === "wood_railing" && entry.position[1] === 6)).toBe(true);
        expect(plan.placements.some((entry) => entry.blockId === "lantern" && entry.position[1] === 7)).toBe(true);
    });

    test("allows lower terrain while rejecting blocks in the deck corridor", () => {
        let chunks = endpoints();
        chunks = setBlock(chunks, [5, 4, 0], "stone");
        expect(planBridge(chunks, [0, 5, 0], [10, 5, 0], "stone").ok).toBe(true);
        chunks = setBlock(chunks, [5, 5, 0], "stone");
        expect(planBridge(chunks, [0, 5, 0], [10, 5, 0], "stone")).toMatchObject({
            ok: false,
            error: "The bridge path or railing space is blocked",
        });
    });

    test("builds a connected diagonal bridge with a diagonal preview axis", () => {
        const start = [0, 5, 0];
        const end = [10, 5, 10];
        let chunks = endpoints(start, end);
        chunks = setBlock(chunks, [1, 5, 0], "stone");
        chunks = setBlock(chunks, [0, 5, 1], "stone");
        const plan = planBridge(chunks, start, end, "wood");
        expect(plan).toMatchObject({ok: true, axis: "diagonal", length: 14});
        expect(plan.placements.some(({position, role}) => role === "deck" && position.join(",") === "5,5,5")).toBe(true);
        expect(plan.placements.some(({position, role}) => role === "railing" && position.join(",") === "4,6,6")).toBe(true);

        const blocked = setBlock(endpoints(start, end), [5, 5, 5], "stone");
        expect(planBridge(blocked, start, end, "wood").error).toBe("The bridge path or railing space is blocked");
    });

    test("requires equal height, distinct endpoints, and bounded length", () => {
        let chunks = endpoints([0, 5, 0], [10, 6, 0]);
        expect(planBridge(chunks, [0, 5, 0], [10, 6, 0]).error).toContain("same height");
        chunks = endpoints([0, 5, 0], [0, 5, 0]);
        expect(planBridge(chunks, [0, 5, 0], [0, 5, 0]).error).toContain("different block");
        chunks = endpoints([0, 5, 0], [BRIDGE_MAX_LENGTH + 1, 5, 0]);
        expect(planBridge(chunks, [0, 5, 0], [BRIDGE_MAX_LENGTH + 1, 5, 0]).error).toContain("cannot exceed");
    });

    test("does not modify chunks while planning", () => {
        const chunks = endpoints();
        const before = getBlock(chunks, [5, 5, 0]);
        planBridge(chunks, [0, 5, 0], [10, 5, 0]);
        expect(getBlock(chunks, [5, 5, 0])).toBe(before);
    });
});
