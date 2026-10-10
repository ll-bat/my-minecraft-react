import {getBlock} from "./chunks";
import {generateChunkColumn} from "./terrain";
import {generateTerrainColumnAsync} from "./terrainStreaming";

describe("terrain streaming fallback", () => {
    test("matches deterministic terrain generation when workers are unavailable", async () => {
        const request = {seed: "streaming", dimension: "overworld", chunkX: 0, chunkZ: 0};
        const streamed = await generateTerrainColumnAsync(request);
        const direct = generateChunkColumn(request.seed, request.chunkX, request.chunkZ);

        expect(streamed.structure).toBeNull();
        expect(streamed.blockLight).toBeInstanceOf(Map);
        expect(streamed.chunks.size).toBe(direct.size);
        expect(getBlock(streamed.chunks, [0, -16, 0])).toBe(getBlock(direct, [0, -16, 0]));
        expect(getBlock(streamed.chunks, [4, 4, 5])).toBe(getBlock(direct, [4, 4, 5]));
    });
});
