import {BLOCK_BY_ID} from "./blocks";
import {chunkCoordinate, locateBlock} from "./chunks";
import {WORLD_MAX_Y, WORLD_MIN_Y} from "./terrain";

export function fluidMovement(direction, verticalVelocity, actions, fluidId) {
    if (fluidId !== "water" && fluidId !== "lava") {
        return null;
    }

    const speedMultiplier = fluidId === "water" ? 0.55 : 0.35;
    const vertical = actions.jump
        ? 2.4
        : actions.swimDown
            ? -2
            : Math.max(-1.25, Math.min(1.25, verticalVelocity * 0.8));

    return [direction.x * speedMultiplier, vertical, direction.z * speedMultiplier];
}

export function watercraftRiderHeight(waterY, definition) {
    return waterY + (definition?.groundOffset ?? 0.5) + (definition?.riderOffset ?? 0.55);
}

export function playerResumePosition(state) {
    const saved = state?.playerPosition;
    if (Array.isArray(saved) && saved.length === 3 && saved.every(Number.isFinite)) return [...saved];
    return [...state.spawn];
}

export function supportCollisionToken(state, position) {
    if (!state || !Array.isArray(position)) return null;
    const supportPosition = [Math.round(position[0]), Math.floor(position[1] - 0.01), Math.round(position[2])];
    const blockId = state.getBlock(supportPosition);
    if (!BLOCK_BY_ID[blockId]?.solid) return null;
    return `${state.worldId}:${locateBlock(supportPosition).chunkKey}`;
}

export function playerRecoveryPosition(state, position) {
    if (!state || !Array.isArray(position)) return null;
    const x = Math.round(position[0]);
    const z = Math.round(position[2]);
    let lowestSolid = null;
    let highestSolid = null;
    for (let y = WORLD_MIN_Y; y <= WORLD_MAX_Y; y += 1) {
        if (!BLOCK_BY_ID[state.getBlock([x, y, z])]?.solid) continue;
        if (lowestSolid === null) lowestSolid = y;
        highestSolid = y;
    }

    if (lowestSolid === null) {
        return position[1] < WORLD_MIN_Y ? [...state.spawn] : null;
    }
    const insideSolid = BLOCK_BY_ID[state.getBlock([x, Math.round(position[1]), z])]?.solid;
    if (position[1] < lowestSolid || insideSolid) {
        return [position[0], highestSolid + 2, position[2]];
    }
    return null;
}

export function collisionColumnReady(state, position) {
    if (!state?.collisionReadyChunkKeys || !Array.isArray(position)) return false;
    const expectedX = chunkCoordinate(position[0]);
    const expectedY = chunkCoordinate(position[1]);
    const expectedZ = chunkCoordinate(position[2]);
    const prefix = `${state.worldId}:`;
    return Array.from(state.collisionReadyChunkKeys).some((token) => {
        if (!token.startsWith(prefix)) return false;
        const [x, y, z] = token.slice(prefix.length).split(",").map(Number);
        return x === expectedX && z === expectedZ && Math.abs(y - expectedY) <= 2;
    });
}
