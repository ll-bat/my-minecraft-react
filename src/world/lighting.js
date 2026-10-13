import {BLOCK_BY_ID} from "./blocks";
import {getBlock} from "./chunks";
import {parsePositionKey, positionKey} from "./coordinates";
import {WORLD_MAX_Y} from "./terrain";
import {rebuildBlockLightCore} from "./lightingCore";

const LIGHT_DIRECTIONS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const MAX_LIGHT_RADIUS = 15;
const LIGHT_SPHERE_VOLUME = 5000;
const lightKey = ([x, y, z]) => `${x},${y},${z}`;

export function emittedLight(blockId) {
    return BLOCK_BY_ID[blockId]?.light ?? (blockId === "lava" ? 15 : 0);
}

export function rebuildBlockLight(chunks) {
    return rebuildBlockLightCore(chunks, BLOCK_BY_ID);
}

function affectedLightPositions(changedPositions) {
    const changed = new Map(changedPositions.map((position) => {
        const normalized = position.map(Math.round);
        return [lightKey(normalized), normalized];
    }));
    const positions = new Map();
    if (changed.size > 8) {
        const values = Array.from(changed.values());
        const minimum = [0, 1, 2].map((axis) => Math.min(...values.map((position) => position[axis])) - MAX_LIGHT_RADIUS);
        const maximum = [0, 1, 2].map((axis) => Math.max(...values.map((position) => position[axis])) + MAX_LIGHT_RADIUS);
        const volume = (maximum[0] - minimum[0] + 1)
            * (maximum[1] - minimum[1] + 1)
            * (maximum[2] - minimum[2] + 1);
        if (volume <= changed.size * LIGHT_SPHERE_VOLUME) {
            for (let x = minimum[0]; x <= maximum[0]; x += 1) {
                for (let y = minimum[1]; y <= maximum[1]; y += 1) {
                    for (let z = minimum[2]; z <= maximum[2]; z += 1) {
                        const position = [x, y, z];
                        positions.set(lightKey(position), position);
                    }
                }
            }
            return positions;
        }
    }
    changed.forEach(([x, y, z]) => {
        for (let dx = -MAX_LIGHT_RADIUS; dx <= MAX_LIGHT_RADIUS; dx += 1) {
            for (let dy = -MAX_LIGHT_RADIUS + Math.abs(dx); dy <= MAX_LIGHT_RADIUS - Math.abs(dx); dy += 1) {
                const remaining = MAX_LIGHT_RADIUS - Math.abs(dx) - Math.abs(dy);
                for (let dz = -remaining; dz <= remaining; dz += 1) {
                    const position = [x + dx, y + dy, z + dz];
                    positions.set(lightKey(position), position);
                }
            }
        }
    });
    return positions;
}

function updateBlockLightCore(chunks, levels, changedPositions) {
    if (!changedPositions.length) return levels;
    const relevantChanges = changedPositions.filter((position) => {
        const normalized = position.map(Math.round);
        if (emittedLight(getBlock(chunks, normalized)) || levels.has(lightKey(normalized))) return true;
        return LIGHT_DIRECTIONS.some((direction) => {
            const neighbor = normalized.map((value, axis) => value + direction[axis]);
            return (levels.get(lightKey(neighbor)) ?? 0) > 1;
        });
    });
    if (!relevantChanges.length) return levels;
    const affected = affectedLightPositions(relevantChanges);
    const queue = [];
    const enqueue = (position, level) => {
        if (level <= 0) return;
        const key = lightKey(position);
        if ((levels.get(key) ?? 0) >= level) return;
        levels.set(key, level);
        queue.push({position, level});
    };

    affected.forEach((_, key) => levels.delete(key));
    affected.forEach((position) => {
        const blockId = getBlock(chunks, position);
        const sourceLevel = emittedLight(blockId);
        if (sourceLevel) enqueue(position, sourceLevel);
        const definition = BLOCK_BY_ID[blockId];
        if (blockId && definition?.solid && !definition.transparent && !sourceLevel) return;
        LIGHT_DIRECTIONS.forEach((direction) => {
            const outside = position.map((value, axis) => value + direction[axis]);
            const outsideKey = lightKey(outside);
            if (!affected.has(outsideKey)) enqueue(position, (levels.get(outsideKey) ?? 0) - 1);
        });
    });

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const {position, level} = queue[cursor];
        if (level <= 1) continue;
        LIGHT_DIRECTIONS.forEach((direction) => {
            const next = position.map((value, axis) => value + direction[axis]);
            const key = lightKey(next);
            if (!affected.has(key)) return;
            const blockId = getBlock(chunks, next);
            const definition = BLOCK_BY_ID[blockId];
            if (blockId && definition?.solid && !definition.transparent) return;
            enqueue(next, level - 1);
        });
    }
    return levels;
}

export function updateBlockLight(chunks, levels, changedPositions) {
    return updateBlockLightCore(chunks, new Map(levels), changedPositions);
}

// Block edits already replace the chunks map, so store subscribers receive a
// new state snapshot without cloning every light entry in a large world.
export function updateBlockLightInPlace(chunks, levels, changedPositions) {
    return updateBlockLightCore(chunks, levels, changedPositions);
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
