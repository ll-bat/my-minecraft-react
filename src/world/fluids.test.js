import {getBlock, setBlock} from "./chunks";
import {processFluidUpdate, queueFluidNeighbors, queueFluidSource} from "./fluids";

function stateWith(blockId, position = [0, 2, 0]) {
    return {
        chunks: setBlock(new Map(), position, blockId),
        fluidLevels: new Map(),
        fluidQueue: queueFluidSource([], position, blockId),
    };
}

describe("fluid updates", () => {
    test("flows downward before spreading sideways", () => {
        const result = processFluidUpdate(stateWith("water"));
        expect(getBlock(result.chunks, [0, 1, 0])).toBe("water");
        expect(getBlock(result.chunks, [1, 2, 0])).toBeNull();
    });

    test("spreads horizontally when supported", () => {
        const state = stateWith("water");
        state.chunks = setBlock(state.chunks, [0, 1, 0], "stone");
        const result = processFluidUpdate(state);
        expect(getBlock(result.chunks, [1, 2, 0])).toBe("water");
        expect(result.fluidLevels.get("1,2,0")).toBe(1);
    });

    test("limits horizontal flow by fluid type", () => {
        let state = stateWith("lava");
        state.chunks = setBlock(state.chunks, [0, 1, 0], "stone");
        state.fluidLevels.set("0,2,0", 3);
        const result = processFluidUpdate(state);
        expect(result.changedPositions).toEqual([]);
    });

    test("turns lava touching water into obsidian", () => {
        let state = stateWith("lava");
        state.chunks = setBlock(state.chunks, [1, 2, 0], "water");
        const result = processFluidUpdate(state);
        expect(getBlock(result.chunks, [0, 2, 0])).toBe("obsidian");
    });

    test("does not enqueue static water after a neighboring edit", () => {
        const chunks = setBlock(new Map(), [1, 2, 0], "water");
        expect(queueFluidNeighbors(chunks, new Map(), [], [0, 2, 0])).toEqual([]);
        expect(queueFluidNeighbors(chunks, new Map([["1,2,0", 1]]), [], [0, 2, 0])).toEqual([
            {position: [1, 2, 0], blockId: "water"},
        ]);
    });
});
