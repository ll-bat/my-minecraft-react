import {BLOCK_BY_ID} from "./blocks";
import {getBlock} from "./chunks";
import {positionKey} from "./coordinates";
import {WORLD_MIN_Y} from "./terrain";

export const BRIDGE_MIN_LENGTH = 4;
export const BRIDGE_MAX_LENGTH = 48;
export const BRIDGE_INTERACTION_DISTANCE = 64;

export const BRIDGE_STYLES = {
    wood: {
        name: "Wooden Bridge",
        deck: "red_wood",
        railing: "wood_railing",
        support: "wood_post",
    },
    stone: {
        name: "Stone Bridge",
        deck: "gray_brick",
        railing: "stone_wall",
        support: "polished_stone",
    },
};

const addPlacement = (placements, seen, position, blockId, role) => {
    const key = positionKey(position);
    if (seen.has(key)) return;
    seen.add(key);
    placements.push({position, blockId, role});
};

const rasterLine = (start, end) => {
    const points = [];
    let x = start[0];
    let z = start[2];
    const endX = end[0];
    const endZ = end[2];
    const dx = Math.abs(endX - x);
    const dz = Math.abs(endZ - z);
    const stepX = x < endX ? 1 : -1;
    const stepZ = z < endZ ? 1 : -1;
    let error = dx - dz;
    while (true) {
        points.push([x, start[1], z]);
        if (x === endX && z === endZ) break;
        const doubled = error * 2;
        if (doubled > -dz) {
            error -= dz;
            x += stepX;
        }
        if (doubled < dx) {
            error += dx;
            z += stepZ;
        }
    }
    return points;
};

const diagonalConnector = (previous, current, deckKeys, y) => {
    if (previous[0] === current[0] || previous[2] === current[2]) return null;
    const candidates = [
        [current[0], y, previous[2]],
        [previous[0], y, current[2]],
    ];
    return candidates.find(([x, , z]) => deckKeys.has(positionKey([x, y - 1, z]))) ?? candidates[0];
};

export function bridgeEndpointError(chunks, position) {
    const blockId = getBlock(chunks, position);
    if (!BLOCK_BY_ID[blockId]?.solid) return "Bridge endpoints must be solid blocks";
    if (getBlock(chunks, [position[0], position[1] + 1, position[2]])
        || getBlock(chunks, [position[0], position[1] + 2, position[2]])) {
        return "Bridge endpoints need two clear blocks above them";
    }
    return null;
}

export function planBridge(chunks, start, end, styleId = "wood") {
    const style = BRIDGE_STYLES[styleId];
    if (!style || !Array.isArray(start) || !Array.isArray(end)) {
        return {ok: false, error: "Choose two valid bridge endpoints", placements: []};
    }
    const firstError = bridgeEndpointError(chunks, start);
    if (firstError) return {ok: false, error: firstError, placements: []};
    const dx = end[0] - start[0];
    const dz = end[2] - start[2];
    if (start[1] !== end[1]) return {ok: false, error: "Bridge endpoints must be at the same height", placements: []};
    if (dx === 0 && dz === 0) return {ok: false, error: "Choose a different block for the bridge end", placements: []};
    const length = Math.round(Math.hypot(dx, dz));
    if (length < BRIDGE_MIN_LENGTH) return {ok: false, error: `Bridge must be at least ${BRIDGE_MIN_LENGTH} blocks long`, placements: []};
    if (length > BRIDGE_MAX_LENGTH) return {ok: false, error: `Bridge cannot exceed ${BRIDGE_MAX_LENGTH} blocks`, placements: []};
    const endError = bridgeEndpointError(chunks, end);
    if (endError) return {ok: false, error: endError, placements: []};

    const centerLine = rasterLine(start, end);
    const diagonal = dx !== 0 && dz !== 0;
    const directionX = Math.sign(dx);
    const directionZ = Math.sign(dz);
    const deckOffsets = diagonal
        ? [[0, 0], [-directionZ, 0], [directionZ, 0], [0, -directionX], [0, directionX]]
        : dx ? [[0, 0], [0, -1], [0, 1]] : [[0, 0], [-1, 0], [1, 0]];
    const railOffset = (side) => diagonal
        ? [-directionZ * side, directionX * side]
        : dx ? [0, side] : [side, 0];
    const placements = [];
    const seen = new Set();
    const deckCells = new Map();
    centerLine.forEach(([x, y, z], index) => {
        const landing = index === 0 || index === centerLine.length - 1;
        deckOffsets.forEach(([offsetX, offsetZ]) => {
            const position = [x + offsetX, y, z + offsetZ];
            const key = positionKey(position);
            const existing = deckCells.get(key);
            deckCells.set(key, {position, landing: existing ? existing.landing || landing : landing});
        });
    });
    const deckKeys = new Set(deckCells.keys());
    for (const {position, landing} of deckCells.values()) {
        const existing = getBlock(chunks, position);
        if (landing && existing && !BLOCK_BY_ID[existing]?.solid) {
            return {ok: false, error: "Each bridge entrance needs a clear landing", placements: []};
        }
        if (!landing && existing) {
            return {ok: false, error: "The bridge path or railing space is blocked", placements: []};
        }
        if (!existing) addPlacement(placements, seen, position, style.deck, "deck");
    }

    [-1, 1].forEach((side) => {
        const [offsetX, offsetZ] = railOffset(side);
        const points = centerLine.map(([x, y, z]) => [x + offsetX, y + 1, z + offsetZ]);
        const connected = [];
        points.forEach((point, index) => {
            if (index) {
                const connector = diagonalConnector(points[index - 1], point, deckKeys, start[1] + 1);
                if (connector) connected.push(connector);
            }
            connected.push(point);
        });
        connected.forEach((position) => addPlacement(placements, seen, position, style.railing, "railing"));
    });

    const lastStep = centerLine.length - 1;
    const lampSteps = new Set([0, lastStep]);
    for (let step = 8; step < lastStep; step += 8) lampSteps.add(step);
    lampSteps.forEach((step) => {
        const sides = step === 0 || step === lastStep ? [-1, 1] : [step % 16 === 0 ? -1 : 1];
        sides.forEach((side) => {
            const [offsetX, offsetZ] = railOffset(side);
            const [x, , z] = centerLine[step];
            addPlacement(placements, seen, [x + offsetX, start[1] + 2, z + offsetZ], "lantern", "lantern");
        });
    });

    for (let step = 7; step < lastStep; step += 7) {
        [-1, 1].forEach((side) => {
            const [offsetX, offsetZ] = railOffset(side);
            const [centerX, , centerZ] = centerLine[step];
            const support = [];
            let reachedGround = false;
            for (let y = start[1] - 1; y >= Math.max(WORLD_MIN_Y + 1, start[1] - 12); y -= 1) {
                const position = [centerX + offsetX, y, centerZ + offsetZ];
                if (BLOCK_BY_ID[getBlock(chunks, position)]?.solid) {
                    reachedGround = true;
                    break;
                }
                if (getBlock(chunks, position)) break;
                support.push(position);
            }
            if (reachedGround) support.forEach((position) => addPlacement(placements, seen, position, style.support, "support"));
        });
    }

    const occupied = placements.find(({position}) => getBlock(chunks, position));
    if (occupied) return {ok: false, error: "The bridge path or railing space is blocked", placements};
    return {ok: true, error: null, placements, length, axis: diagonal ? "diagonal" : dx ? "x" : "z", style: styleId};
}
