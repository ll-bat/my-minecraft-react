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
        };

        const streamed = await buildChunkMeshAsync(request);
        const direct = buildChunkMeshData(chunks, chunkKey, chunks.get(chunkKey), 1);

        expect(streamed.materials.get("stone").positions).toEqual(direct.materials.get("stone").positions);
        expect(streamed.materials.get("glass").uvs).toEqual(direct.materials.get("glass").uvs);
        expect(streamed.collision).toEqual(direct.collision);
    });
});
