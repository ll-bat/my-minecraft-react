export const MAX_INTERACTION_DISTANCE = 6;
export const PLAYER_RADIUS = 0.5;

const FACE_OFFSETS = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
];

export function normalizePosition(position) {
    return position.map((coordinate) => Math.round(Number(coordinate)));
}

export function positionKey(position) {
    return normalizePosition(position).join(",");
}

export function parsePositionKey(key) {
    return String(key).split(",").map(Number);
}

export function adjacentPosition(position, faceIndex) {
    const offset = FACE_OFFSETS[Math.floor(faceIndex / 2)];
    if (!offset) {
        return null;
    }

    return normalizePosition(position).map((coordinate, index) => (
        coordinate + offset[index]
    ));
}

export function blockIntersectsPlayer(blockPosition, playerPosition) {
    const [blockX, blockY, blockZ] = normalizePosition(blockPosition);
    const [playerX, playerY, playerZ] = playerPosition;

    const closestX = Math.max(blockX - 0.5, Math.min(playerX, blockX + 0.5));
    const closestY = Math.max(blockY - 0.5, Math.min(playerY, blockY + 0.5));
    const closestZ = Math.max(blockZ - 0.5, Math.min(playerZ, blockZ + 0.5));

    const distanceSquared = (
        (playerX - closestX) ** 2
        + (playerY - closestY) ** 2
        + (playerZ - closestZ) ** 2
    );

    return distanceSquared < PLAYER_RADIUS ** 2;
}
