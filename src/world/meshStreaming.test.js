import {BLOCK_BY_ID} from "./blocks";
import {buildChunkMeshData} from "./chunkGeometry";
import {setBlock} from "./chunks";
import {buildChunkMeshAsync} from "./meshStreaming";

const blockDefinitions = Object.fromEntries(Object.values(BLOCK_BY_ID).map((block) => [
    block.id,
    {
        fluid: Boolean(block.fluid),
        shape: block.shape,
        solid: Boolean(block.solid),
        transparent: Boolean(block.transparent),
        textures: block.textures,
        variants: block.variants,
        atlasEntries: block.atlasEntries,
        collisionBounds: block.collisionBounds,
        biomeTint: block.biomeTint,
        biomeTintFaces: block.biomeTintFaces,
        animation: block.animation,
    },
]));

describe("mesh streaming fallback", () => {
    test("matches synchronous chunk geometry when workers are unavailable", async () => {
        let chunks = setBlock(new Map(), [0, 0, 0], "stone");
        chunks = setBlock(chunks, [1, 0, 0], "glass");
        const chunkKey = "0,0,0";
        const request = {
            chunks,
            chunkKey,
            selectedChunk: chunks.get(chunkKey),
            revision: 1,
            blockStates: new Map(),
            blockDefinitions,
            worldSeed: "stream-test",
        };

        const streamed = await buildChunkMeshAsync(request);
        const direct = buildChunkMeshData(chunks, chunkKey, chunks.get(chunkKey), 1, new Map(), "stream-test");

        expect(streamed.materials.get("atlas:opaque").positions).toEqual(direct.materials.get("atlas:opaque").positions);
        expect(streamed.materials.get("atlas:translucent:static:glass").uvs).toEqual(direct.materials.get("atlas:translucent:static:glass").uvs);
        expect(streamed.materials.get("atlas:opaque").colors).toEqual(direct.materials.get("atlas:opaque").colors);
        expect(streamed.collision).toEqual(direct.collision);
    });
});
