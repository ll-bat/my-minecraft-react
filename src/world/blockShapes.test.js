import {shapeParts} from "./blockShapes";

describe("construction block shapes", () => {
    test("places slabs in the selected half of a voxel", () => {
        expect(shapeParts({shape: "slab"}, {half: "lower"})).toEqual([[-0.5, 0.5, -0.5, 0, -0.5, 0.5]]);
        expect(shapeParts({shape: "slab"}, {half: "upper"})).toEqual([[-0.5, 0.5, 0, 0.5, -0.5, 0.5]]);
    });

    test("rotates the raised stair step toward its facing direction", () => {
        const north = shapeParts({shape: "stairs"}, {facing: "north", half: "lower"});
        const east = shapeParts({shape: "stairs"}, {facing: "east", half: "lower"});
        expect(north[1]).toEqual([-0.5, 0.5, 0, 0.5, -0.5, 0]);
        expect(east[1]).toEqual([0, 0.5, 0, 0.5, -0.5, 0.5]);
    });

    test("adds two rails for each connectable fence neighbor", () => {
        const isolated = shapeParts({shape: "fence"});
        const connected = shapeParts({shape: "fence"}, {}, ([x, , z]) => (
            x === 1 || z === -1 ? {solid: true} : null
        ));
        expect(isolated).toHaveLength(1);
        expect(connected).toHaveLength(5);
    });
});

