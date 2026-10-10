import {BLOCK_BY_ID} from "./blocks";
import {getBlock} from "./chunks";
import {parsePositionKey, positionKey} from "./coordinates";
import {WORLD_MAX_Y} from "./terrain";
import {rebuildBlockLightCore} from "./lightingCore";

export function emittedLight(blockId) {
    return BLOCK_BY_ID[blockId]?.light ?? (blockId === "lava" ? 15 : 0);
}

export function rebuildBlockLight(chunks) {
    return rebuildBlockLightCore(chunks, BLOCK_BY_ID);
}

export function skyLightAt(chunks, position) {
    for (let y = position[1] + 1; y <= WORLD_MAX_Y; y += 1) {
        const blockId = getBlock(chunks, [position[0], y, position[2]]);
        if (blockId && BLOCK_BY_ID[blockId]?.solid && !BLOCK_BY_ID[blockId]?.transparent) return 0;
    }
    return 15;
}

export function lightAt(chunks, levels, position) {
    return Math.max(skyLightAt(chunks, position), levels.get(positionKey(position)) ?? 0);
}

export function lightSources(levels, minimum = 14) {
    return Array.from(levels)
        .filter(([, level]) => level >= minimum)
        .map(([key, level]) => ({position: parsePositionKey(key), level}));
}
