const PARTIAL_SHAPES = new Set([
    "bed", "beam", "door", "farmland", "fence", "ladder", "lantern", "model", "post",
    "railing", "slab", "stairs", "torch", "track", "elevator", "trapdoor", "wall",
]);

const CONNECTIONS = [
    {direction: "north", offset: [0, 0, -1]},
    {direction: "south", offset: [0, 0, 1]},
    {direction: "east", offset: [1, 0, 0]},
    {direction: "west", offset: [-1, 0, 0]},
];

export function isPartialShape(shape) {
    return PARTIAL_SHAPES.has(shape);
}

export function rotateBounds(bounds, facing = "north") {
    const [minX, maxX, minY, maxY, minZ, maxZ] = bounds;
    const rotated = facing === "south" ? [-maxX, -minX, minY, maxY, -maxZ, -minZ]
        : facing === "east" ? [-maxZ, -minZ, minY, maxY, minX, maxX]
            : facing === "west" ? [minZ, maxZ, minY, maxY, -maxX, -minX]
                : bounds;
    return rotated.map((value) => Object.is(value, -0) ? 0 : value);
}

function connectionBounds(direction, width, minY, maxY) {
    if (direction === "north") return [-width, width, minY, maxY, -0.5, 0];
    if (direction === "south") return [-width, width, minY, maxY, 0, 0.5];
    if (direction === "east") return [0, 0.5, minY, maxY, -width, width];
    return [-0.5, 0, minY, maxY, -width, width];
}

function canConnect(neighbor) {
    if (!neighbor?.solid) return false;
    return !["bed", "door", "farmland", "ladder", "model", "slab", "stairs", "trapdoor"].includes(neighbor.shape);
}

function connectedParts(shape, neighborAt) {
    const connected = CONNECTIONS.filter(({offset}) => canConnect(neighborAt(offset)));
    if (shape === "wall") {
        return [
            [-0.25, 0.25, -0.5, 0.5, -0.25, 0.25],
            ...connected.map(({direction}) => connectionBounds(direction, 0.25, -0.5, 0.25)),
        ];
    }
    if (shape === "railing") {
        return [
            [-0.09, 0.09, -0.5, 0.42, -0.09, 0.09],
            ...connected.flatMap(({direction}) => [
                connectionBounds(direction, 0.07, -0.18, -0.06),
                connectionBounds(direction, 0.07, 0.2, 0.32),
            ]),
        ];
    }
    return [
        [-0.125, 0.125, -0.5, 0.5, -0.125, 0.125],
        ...connected.flatMap(({direction}) => [
            connectionBounds(direction, 0.075, -0.18, -0.04),
            connectionBounds(direction, 0.075, 0.2, 0.34),
        ]),
    ];
}

export function shapeParts(definition, state = {}, neighborAt = () => null) {
    const facing = state.facing ?? "north";
    switch (definition.shape) {
        case "bed": return [[-0.5, 0.5, -0.5, 0, -0.5, 0.5]];
        case "farmland": return [[-0.5, 0.5, -0.5, 0.375, -0.5, 0.5]];
        case "slab": return [state.half === "upper"
            ? [-0.5, 0.5, 0, 0.5, -0.5, 0.5]
            : [-0.5, 0.5, -0.5, 0, -0.5, 0.5]];
        case "elevator": return [[-0.5, 0.5, 0.32, 0.5, -0.5, 0.5]];
        case "track": return [
            rotateBounds([-0.4, -0.28, -0.48, -0.39, -0.5, 0.5], facing),
            rotateBounds([0.28, 0.4, -0.48, -0.39, -0.5, 0.5], facing),
            rotateBounds([-0.5, 0.5, -0.5, -0.43, -0.4, -0.3], facing),
            rotateBounds([-0.5, 0.5, -0.5, -0.43, 0.3, 0.4], facing),
        ];
        case "stairs": {
            const upper = state.half === "upper";
            const parts = upper
                ? [[-0.5, 0.5, 0, 0.5, -0.5, 0.5], [-0.5, 0.5, -0.5, 0, -0.5, 0]]
                : [[-0.5, 0.5, -0.5, 0, -0.5, 0.5], [-0.5, 0.5, 0, 0.5, -0.5, 0]];
            return parts.map((bounds) => rotateBounds(bounds, facing));
        }
        case "fence": case "wall": case "railing": return connectedParts(definition.shape, neighborAt);
        case "post": return [[-0.16, 0.16, -0.5, 0.5, -0.16, 0.16]];
        case "beam": return [rotateBounds([-0.5, 0.5, -0.16, 0.16, -0.16, 0.16], facing)];
        case "torch": return [
            [-0.055, 0.055, -0.5, 0.18, -0.055, 0.055],
            [-0.12, 0.12, 0.18, 0.38, -0.12, 0.12],
        ];
        case "lantern": return [
            [-0.23, 0.23, -0.42, -0.32, -0.23, 0.23],
            [-0.19, 0.19, -0.32, 0.2, -0.19, 0.19],
            [-0.24, 0.24, 0.2, 0.3, -0.24, 0.24],
            [-0.18, -0.1, 0.3, 0.48, -0.05, 0.05],
            [0.1, 0.18, 0.3, 0.48, -0.05, 0.05],
            [-0.18, 0.18, 0.42, 0.5, -0.05, 0.05],
        ];
        case "trapdoor":
            if (!state.open) return [[-0.5, 0.5, -0.5, -0.32, -0.5, 0.5]];
            break;
        default: break;
    }

    const openDoor = definition.shape === "door" && state.open;
    const vertical = definition.shape === "ladder" || openDoor || (definition.shape === "trapdoor" && state.open);
    const thickness = 3 / 16;
    if (!vertical) return [facing === "north" || facing === "south"
        ? [-0.5, 0.5, -0.5, 0.5, facing === "north" ? -0.5 : 0.5 - thickness, facing === "north" ? -0.5 + thickness : 0.5]
        : [facing === "west" ? -0.5 : 0.5 - thickness, facing === "west" ? -0.5 + thickness : 0.5, -0.5, 0.5, -0.5, 0.5]];
    const sideFacing = openDoor ? ({north: "west", south: "east", east: "north", west: "south"}[facing]) : facing;
    return [sideFacing === "north" || sideFacing === "south"
        ? [-0.5, 0.5, -0.5, 0.5, sideFacing === "north" ? -0.5 : 0.5 - thickness, sideFacing === "north" ? -0.5 + thickness : 0.5]
        : [sideFacing === "west" ? -0.5 : 0.5 - thickness, sideFacing === "west" ? -0.5 + thickness : 0.5, -0.5, 0.5, -0.5, 0.5]];
}

