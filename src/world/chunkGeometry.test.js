import {setBlock} from "./chunks";
import {buildChunkMeshData, voxelFromIntersection} from "./chunkGeometry";
import {BLOCK_BY_ID} from "./blocks";

describe("chunk geometry", () => {
    test("hides the shared face between neighboring solid blocks", () => {
        let chunks = setBlock(new Map(), [0, 0, 0], "stone");
        chunks = setBlock(chunks, [1, 0, 0], "stone");
        const mesh = buildChunkMeshData(chunks, "0,0,0");

        expect(mesh.materials.get("atlas:opaque").positions).toHaveLength(10 * 18);
    });

    test("a thin door does not cut a hole in a neighboring full cube", () => {
        let chunks = setBlock(new Map(), [0, 0, 0], "stone");
        chunks = setBlock(chunks, [1, 0, 0], "door");
        const mesh = buildChunkMeshData(chunks, "0,0,0", undefined, 0, new Map([
            ["1,0,0", {facing: "north", open: false}],
        ]));

        expect(mesh.materials.get("atlas:opaque").positions).toHaveLength(12 * 18);
        expect(mesh.materials.has("door")).toBe(false);
    });

    test("keeps an opened door visible while removing its doorway collision", () => {
        let chunks = setBlock(new Map(), [0, 0, 0], "door_open");
        chunks = setBlock(chunks, [0, 1, 0], "door_open_top");
        const mesh = buildChunkMeshData(chunks, "0,0,0", undefined, 0, new Map([
            ["0,0,0", {facing: "north", open: true}],
            ["0,1,0", {facing: "north", open: true}],
        ]));

        expect(mesh.materials.get("atlas:opaque").positions).toHaveLength(12 * 18);
        expect(mesh.collision.vertices).toHaveLength(0);
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
        const positions = mesh.materials.get("atlas:translucent:water:water").positions;
        const yCoordinates = positions.filter((_, index) => index % 3 === 1);

        expect(positions).toHaveLength(10 * 18);
        expect(Math.max(...yCoordinates)).toBeCloseTo(1.4);
        expect(yCoordinates).toContain(0.5);
    });

    test("keeps incompatible translucent block types in separate sortable batches", () => {
        let chunks = setBlock(new Map(), [0, 0, 0], "glass");
        chunks = setBlock(chunks, [2, 0, 0], "window");
        chunks = setBlock(chunks, [4, 0, 0], "water");
        const materials = buildChunkMeshData(chunks, "0,0,0").materials;

        expect(materials.has("atlas:translucent:static:glass")).toBe(true);
        expect(materials.has("atlas:translucent:static:window")).toBe(true);
        expect(materials.has("atlas:translucent:water:water")).toBe(true);
    });

    test("uses the configured atlas region for the top face", () => {
        const chunks = setBlock(new Map(), [0, 0, 0], "grass");
        const mesh = buildChunkMeshData(chunks, "0,0,0");
        const uvs = mesh.materials.get("atlas:opaque").uvs;
        const topFace = uvs.slice(24, 36);
        const expectedFaces = ["grass_top", "grass_top_variant"].map((name) => {
            const [u0, v0, u1, v1] = BLOCK_BY_ID.grass.atlasEntries[name].uv;
            return [u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1];
        });

        expect(expectedFaces).toContainEqual(topFace);
        expect(buildChunkMeshData(chunks, "0,0,0").materials.get("atlas:opaque").uvs.slice(24, 36)).toEqual(topFace);
    });

    test("rotates a directional front texture with the placed block", () => {
        const chunks = setBlock(new Map(), [0, 0, 0], "furnace");
        const mesh = buildChunkMeshData(chunks, "0,0,0", undefined, 0, new Map([
            ["0,0,0", {facing: "east"}],
        ]));
        const uvs = mesh.materials.get("atlas:opaque").uvs;
        const [u0, v0, u1, v1] = BLOCK_BY_ID.furnace.atlasEntries.oven.uv;

        expect(uvs.slice(0, 12)).toEqual([u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1]);
    });

    test("meshes connected fences as posts with joining rails", () => {
        let chunks = setBlock(new Map(), [0, 0, 0], "wood_fence");
        chunks = setBlock(chunks, [1, 0, 0], "wood_fence");
        const mesh = buildChunkMeshData(chunks, "0,0,0");

        expect(mesh.materials.get("atlas:opaque").positions).toHaveLength(6 * 6 * 18);
        expect(mesh.collision.vertices).toHaveLength(6 * 6 * 18);
    });

    test("keeps model visuals out of chunk batches while building their collision", () => {
        const chunks = setBlock(new Map(), [0, 0, 0], "chair");
        const mesh = buildChunkMeshData(chunks, "0,0,0", undefined, 0, new Map([["0,0,0", {facing: "east"}]]));
        expect(mesh.materials.size).toBe(0);
        expect(mesh.collision.vertices).toHaveLength(6 * 18);
    });

    test("adds directional face shading as vertex colors", () => {
        const chunks = setBlock(new Map(), [0, 0, 0], "stone");
        const colors = buildChunkMeshData(chunks, "0,0,0").materials.get("atlas:opaque").colors;

        expect(colors).toHaveLength(6 * 18);
        expect(colors.slice(36, 39)).toEqual([1, 1, 1]);
        expect(colors.slice(54, 57)).toEqual([0.62, 0.62, 0.62]);
        expect(colors.slice(90, 93)).toEqual([0.76, 0.76, 0.76]);
    });

    test("greedily merges compatible opaque faces while retaining per-block texture tiles", () => {
        let chunks = setBlock(new Map(), [0, 0, 0], "wood");
        chunks = setBlock(chunks, [1, 0, 0], "wood");
        const data = buildChunkMeshData(chunks, "0,0,0").materials.get("atlas:opaque");

        expect(data.positions).toHaveLength(6 * 18);
        expect(Math.max(...data.tileUvs)).toBe(2);
        expect(data.atlasRects).toHaveLength(6 * 6 * 4);
    });

    test("tints foliage according to its deterministic biome", () => {
        const chunks = setBlock(new Map(), [0, 0, 0], "leaves");
        const colors = buildChunkMeshData(chunks, "0,0,0", undefined, 0, new Map(), "tint-seed")
            .materials.get("atlas:cutout").colors;

        expect(colors.slice(36, 39)).not.toEqual([1, 1, 1]);
    });
});
