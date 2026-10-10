import {getBlock} from "./chunks";
import {positionKey} from "./coordinates";

const DIRECTIONS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

export function rebuildBlockLightCore(chunks, blockDefinitions = {}) {
    const levels = new Map();
    const queue = [];
    chunks.forEach((chunk, chunkKey) => {
        const [chunkX, chunkY, chunkZ] = chunkKey.split(",").map(Number);
        chunk.forEach((blockId, index) => {
            const light = blockDefinitions[blockId]?.light ?? (blockId === "lava" ? 15 : 0);
            if (!light) return;
            const localX = index % 16;
            const localZ = Math.floor(index / 16) % 16;
            const localY = Math.floor(index / 256);
            const position = [chunkX * 16 + localX, chunkY * 16 + localY, chunkZ * 16 + localZ];
            levels.set(positionKey(position), light);
            queue.push({position, level: light});
        });
    });

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const {position, level} = queue[cursor];
        if (level <= 1) continue;
        DIRECTIONS.forEach((direction) => {
            const next = position.map((value, axis) => value + direction[axis]);
            const blockId = getBlock(chunks, next);
            const block = blockDefinitions[blockId];
            if (blockId && block?.solid && !block.transparent) return;
            const key = positionKey(next);
            const nextLevel = level - 1;
            if ((levels.get(key) ?? 0) >= nextLevel) return;
            levels.set(key, nextLevel);
            queue.push({position: next, level: nextLevel});
        });
    }
    return levels;
}
