import {getBlock, setBlock} from "./chunks";
import {positionKey} from "./coordinates";

export const CHEST_SIZE = 27;
export const CROP_GROWTH_MS = 30000;
export const CARDINAL_DIRECTIONS = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];

export function createChest() {
    return {type: "chest", slots: Array(CHEST_SIZE).fill(null), revision: 0};
}

export function facingFromDirection([x, , z]) {
    if (Math.abs(x) > Math.abs(z)) return x > 0 ? "east" : "west";
    return z > 0 ? "south" : "north";
}

export function isCrop(blockId) {
    return /^crop_[0-3]$/.test(blockId ?? "");
}

export function isHydrated(chunks, position, radius = 4) {
    for (let x = -radius; x <= radius; x += 1) {
        for (let z = -radius; z <= radius; z += 1) {
            if (getBlock(chunks, [position[0] + x, position[1], position[2] + z]) === "water") return true;
        }
    }
    return false;
}

export function growCrop(chunks, position) {
    const blockId = getBlock(chunks, position);
    if (!isCrop(blockId) || blockId === "crop_3") return {chunks, changed: false, mature: blockId === "crop_3"};
    if (getBlock(chunks, [position[0], position[1] - 1, position[2]]) !== "farmland") {
        return {chunks: setBlock(chunks, position, null), changed: true, mature: false};
    }
    if (!isHydrated(chunks, [position[0], position[1] - 1, position[2]])) {
        return {chunks, changed: false, mature: false};
    }
    const stage = Number(blockId.slice(-1));
    return {chunks: setBlock(chunks, position, `crop_${stage + 1}`), changed: true, mature: stage + 1 === 3};
}

export function toggleBlock(chunks, position) {
    const current = getBlock(chunks, position);
    if (["door", "door_top", "door_open", "door_open_top"].includes(current)) {
        const base = current.endsWith("_top") || current === "door_top"
            ? [position[0], position[1] - 1, position[2]]
            : [...position];
        const opening = current === "door" || current === "door_top";
        let nextChunks = setBlock(chunks, base, opening ? "door_open" : "door");
        nextChunks = setBlock(nextChunks, [base[0], base[1] + 1, base[2]], opening ? "door_open_top" : "door_top");
        return {chunks: nextChunks, blockId: opening ? "door_open" : "door", positions: [base, [base[0], base[1] + 1, base[2]]], open: opening};
    }
    const toggles = {trapdoor: "trapdoor_open", trapdoor_open: "trapdoor"};
    const next = toggles[current];
    return next ? {chunks: setBlock(chunks, position, next), blockId: next, positions: [position], open: next === "trapdoor_open"} : null;
}

export function propagateSwitch(chunks, position, powered) {
    let nextChunks = chunks;
    const changed = [];
    CARDINAL_DIRECTIONS.concat([[0, 1, 0], [0, -1, 0]]).forEach((direction) => {
        const neighbor = position.map((value, axis) => value + direction[axis]);
        const blockId = getBlock(nextChunks, neighbor);
        if (blockId !== "lamp" && blockId !== "lamp_on") return;
        const target = powered ? "lamp_on" : "lamp";
        if (target !== blockId) {
            nextChunks = setBlock(nextChunks, neighbor, target);
            changed.push(neighbor);
        }
    });
    return {chunks: nextChunks, changed};
}

export function scheduleCrop(position, due = Date.now() + CROP_GROWTH_MS) {
    return {id: `${positionKey(position)}:${due}`, type: "crop", position: [...position], due};
}
