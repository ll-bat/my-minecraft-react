import {BLOCK_BY_ID} from "./blocks";
import {getBlock, setBlock} from "./chunks";
import {positionKey} from "./coordinates";
import {WORLD_MIN_Y} from "./terrain";

const HORIZONTAL_DIRECTIONS = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 0, 1],
    [0, 0, -1],
];

const ALL_DIRECTIONS = [
    ...HORIZONTAL_DIRECTIONS,
    [0, 1, 0],
    [0, -1, 0],
];

function neighbor(position, direction) {
    return position.map((coordinate, index) => coordinate + direction[index]);
}

function enqueue(queue, position, blockId) {
    const key = `${blockId}:${positionKey(position)}`;
    if (queue.some((entry) => `${entry.blockId}:${positionKey(entry.position)}` === key)) {
        return queue;
    }
    return [...queue, {position, blockId}];
}

export function queueFluidNeighbors(chunks, fluidLevels, queue, position) {
    let nextQueue = queue;
    ALL_DIRECTIONS.forEach((direction) => {
        const candidate = neighbor(position, direction);
        const blockId = getBlock(chunks, candidate);
        if (BLOCK_BY_ID[blockId]?.fluid && fluidLevels.has(positionKey(candidate))) {
            nextQueue = enqueue(nextQueue, candidate, blockId);
        }
    });
    return nextQueue;
}

export function queueFluidSource(queue, position, blockId) {
    return enqueue(queue, position, blockId);
}

export function processFluidUpdate({chunks, fluidLevels, fluidQueue}, allowLava = true) {
    if (fluidQueue.length === 0) {
        return {chunks, fluidLevels, fluidQueue, changedPositions: []};
    }

    const [entry, ...remaining] = fluidQueue;
    if (entry.blockId === "lava" && !allowLava) {
        return {
            chunks,
            fluidLevels,
            fluidQueue: [...remaining, entry],
            changedPositions: [],
        };
    }

    if (getBlock(chunks, entry.position) !== entry.blockId) {
        return {chunks, fluidLevels, fluidQueue: remaining, changedPositions: []};
    }

    let nextChunks = chunks;
    let nextLevels = new Map(fluidLevels);
    let nextQueue = remaining;
    const changedPositions = [];
    const oppositeFluid = entry.blockId === "water" ? "lava" : "water";

    for (const direction of ALL_DIRECTIONS) {
        const candidate = neighbor(entry.position, direction);
        if (getBlock(nextChunks, candidate) === oppositeFluid) {
            const lavaPosition = entry.blockId === "lava" ? entry.position : candidate;
            nextChunks = setBlock(nextChunks, lavaPosition, "obsidian");
            nextLevels.delete(positionKey(lavaPosition));
            changedPositions.push(lavaPosition);
            return {chunks: nextChunks, fluidLevels: nextLevels, fluidQueue: nextQueue, changedPositions};
        }
    }

    const definition = BLOCK_BY_ID[entry.blockId];
    const currentLevel = nextLevels.get(positionKey(entry.position)) ?? 0;
    const below = neighbor(entry.position, [0, -1, 0]);

    if (below[1] > WORLD_MIN_Y && !getBlock(nextChunks, below)) {
        nextChunks = setBlock(nextChunks, below, entry.blockId);
        nextLevels.set(positionKey(below), currentLevel);
        nextQueue = enqueue(nextQueue, below, entry.blockId);
        changedPositions.push(below);
        return {chunks: nextChunks, fluidLevels: nextLevels, fluidQueue: nextQueue, changedPositions};
    }

    if (currentLevel < definition.flowDistance) {
        HORIZONTAL_DIRECTIONS.forEach((direction) => {
            const candidate = neighbor(entry.position, direction);
            if (!getBlock(nextChunks, candidate)) {
                nextChunks = setBlock(nextChunks, candidate, entry.blockId);
                nextLevels.set(positionKey(candidate), currentLevel + 1);
                nextQueue = enqueue(nextQueue, candidate, entry.blockId);
                changedPositions.push(candidate);
            }
        });
    }

    return {chunks: nextChunks, fluidLevels: nextLevels, fluidQueue: nextQueue, changedPositions};
}
