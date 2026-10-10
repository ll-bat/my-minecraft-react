import {setBlock} from "./chunks";
import {buildChunkMeshData, voxelFromIntersection} from "./chunkGeometry";

describe("chunk geometry", () => {
    test("hides the shared face between neighboring solid blocks", () => {
        let chunks = setBlock(new Map(), [0, 0, 0], "stone");
        chunks = setBlock(chunks, [1, 0, 0], "stone");
        const mesh = buildChunkMeshData(chunks, "0,0,0");

        expect(mesh.materials.get("stone").positions).toHaveLength(10 * 18);
    });

    test("a thin door does not cut a hole in a neighboring full cube", () => {
        let chunks = setBlock(new Map(), [0, 0, 0], "stone");
        chunks = setBlock(chunks, [1, 0, 0], "door");
        const mesh = buildChunkMeshData(chunks, "0,0,0", undefined, 0, new Map([
            ["1,0,0", {facing: "north", open: false}],
        ]));

        expect(mesh.materials.get("stone").positions).toHaveLength(6 * 18);
        expect(mesh.materials.get("door").positions).toHaveLength(6 * 18);
    });

    test("maps an intersection to the inside and outside voxels", () => {
        const point = {x: 0.5, y: 0, z: 0};
        const normal = {x: 1, y: 0, z: 0};
        expect(voxelFromIntersection(point, normal)).toEqual([0, 0, 0]);
        expect(voxelFromIntersection(point, normal, true)).toEqual([1, 0, 0]);
    });

    test("hides internal water faces and lowers only the exposed surface", () => {
        let chunks = setBlock(new Map(), [0, 0, 0], "water");
        chunks = setBlock(chunks, [0, 1, 0], "water");
        const mesh = buildChunkMeshData(chunks, "0,0,0");
        const positions = mesh.materials.get("water").positions;
        const yCoordinates = positions.filter((_, index) => index % 3 === 1);

        expect(positions).toHaveLength(10 * 18);
        expect(Math.max(...yCoordinates)).toBeCloseTo(1.4);
        expect(yCoordinates).toContain(0.5);
    });
});
