import {getBlock, indexToLocal, parseChunkKey, worldPosition} from "./chunks";
import {positionKey} from "./coordinates";

const FACES = [
    {normal: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0]},
    {normal: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0]},
    {normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1]},
    {normal: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1]},
    {normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0]},
    {normal: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0]},
];

const TRIANGLE_ORDER = [0, 1, 2, 0, 2, 3];
const UVS = [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1];
const PARTIAL_SHAPES = new Set(["door", "trapdoor", "ladder", "bed", "farmland", "cross"]);
const DOOR_THICKNESS = 3 / 16;

function faceCorners(position, face, fluid = false) {
    const [x, y, z] = position;
    const center = [
        x + face.normal[0] * 0.5,
        y + face.normal[1] * 0.5,
        z + face.normal[2] * 0.5,
    ];
    const corners = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
    ].map(([uScale, vScale]) => [
        center[0] + (face.u[0] * uScale + face.v[0] * vScale) * 0.5,
        center[1] + (face.u[1] * uScale + face.v[1] * vScale) * 0.5,
        center[2] + (face.u[2] * uScale + face.v[2] * vScale) * 0.5,
    ]);
    if (fluid) {
        corners.forEach((corner) => {
            if (corner[1] > y) {
                corner[1] = y + 0.4;
            }
        });
    }
    return corners;
}

function addFace(data, position, face, fluid = false) {
    const corners = faceCorners(position, face, fluid);
    TRIANGLE_ORDER.forEach((cornerIndex) => {
        data.positions.push(...corners[cornerIndex]);
        data.normals.push(...face.normal);
    });
    data.uvs.push(...UVS);
}

function addPlant(data, [x, y, z]) {
    const planes = [
        [[x - 0.5, y - 0.5, z - 0.5], [x + 0.5, y - 0.5, z + 0.5], [x + 0.5, y + 0.5, z + 0.5], [x - 0.5, y + 0.5, z - 0.5]],
        [[x + 0.5, y - 0.5, z - 0.5], [x - 0.5, y - 0.5, z + 0.5], [x - 0.5, y + 0.5, z + 0.5], [x + 0.5, y + 0.5, z - 0.5]],
    ];

    planes.forEach((corners) => {
        TRIANGLE_ORDER.forEach((cornerIndex) => {
            data.positions.push(...corners[cornerIndex]);
            data.normals.push(0, 1, 0);
        });
        data.uvs.push(...UVS);
    });
}

function addCuboid(data, collision, [x, y, z], bounds, solid) {
    const [minX, maxX, minY, maxY, minZ, maxZ] = bounds;
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const midZ = (minZ + maxZ) / 2;
    const centers = [
        [x + maxX, y + midY, z + midZ], [x + minX, y + midY, z + midZ], [x + midX, y + maxY, z + midZ],
        [x + midX, y + minY, z + midZ], [x + midX, y + midY, z + maxZ], [x + midX, y + midY, z + minZ],
    ];
    FACES.forEach((face, faceIndex) => {
        const center = centers[faceIndex];
        const uScale = face.u[0] ? (maxX - minX) : face.u[1] ? (maxY - minY) : (maxZ - minZ);
        const vScale = face.v[0] ? (maxX - minX) : face.v[1] ? (maxY - minY) : (maxZ - minZ);
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [
            center[0] + face.u[0] * u * uScale / 2 + face.v[0] * v * vScale / 2,
            center[1] + face.u[1] * u * uScale / 2 + face.v[1] * v * vScale / 2,
            center[2] + face.u[2] * u * uScale / 2 + face.v[2] * v * vScale / 2,
        ]);
        TRIANGLE_ORDER.forEach((cornerIndex) => {
            data.positions.push(...corners[cornerIndex]);
            data.normals.push(...face.normal);
            if (solid) {
                collision.vertices.push(...corners[cornerIndex]);
                collision.indices.push(collision.indices.length);
            }
        });
        data.uvs.push(...UVS);
    });
}

function shapedBounds(definition, state = {}) {
    const facing = state.facing ?? "north";
    if (definition.shape === "bed") return [-0.5, 0.5, -0.5, 0, -0.5, 0.5];
    if (definition.shape === "farmland") return [-0.5, 0.5, -0.5, 0.375, -0.5, 0.5];
    if (definition.shape === "trapdoor" && !state.open) return [-0.5, 0.5, -0.5, -0.32, -0.5, 0.5];
    const openDoor = definition.shape === "door" && state.open;
    const vertical = definition.shape === "ladder" || openDoor || (definition.shape === "trapdoor" && state.open);
    if (!vertical) return facing === "north" || facing === "south"
        ? [-0.5, 0.5, -0.5, 0.5, facing === "north" ? -0.5 : 0.5 - DOOR_THICKNESS, facing === "north" ? -0.5 + DOOR_THICKNESS : 0.5]
        : [facing === "west" ? -0.5 : 0.5 - DOOR_THICKNESS, facing === "west" ? -0.5 + DOOR_THICKNESS : 0.5, -0.5, 0.5, -0.5, 0.5];
    const sideFacing = openDoor
        ? ({north: "west", south: "east", east: "north", west: "south"}[facing])
        : facing;
    return sideFacing === "north" || sideFacing === "south"
        ? [-0.5, 0.5, -0.5, 0.5, sideFacing === "north" ? -0.5 : 0.5 - DOOR_THICKNESS, sideFacing === "north" ? -0.5 + DOOR_THICKNESS : 0.5]
        : [sideFacing === "west" ? -0.5 : 0.5 - DOOR_THICKNESS, sideFacing === "west" ? -0.5 + DOOR_THICKNESS : 0.5, -0.5, 0.5, -0.5, 0.5];
}

function occludesNeighborFace(definition) {
    return definition.solid && !definition.transparent && !PARTIAL_SHAPES.has(definition.shape);
}

function visibleFace(chunks, blockId, position, normal, blockDefinitions) {
    const neighborId = getBlock(chunks, position.map((value, index) => value + normal[index]));
    if (!neighborId) {
        return true;
    }
    if (neighborId === blockId) {
        return false;
    }
    const neighbor = blockDefinitions[neighborId];
    if (!neighbor) return true;
    return !occludesNeighborFace(neighbor) || (neighbor.transparent && neighborId !== blockId);
}

function emptyMeshData() {
    return {positions: [], normals: [], uvs: []};
}

export function buildChunkMeshDataCore(chunks, key, selectedChunk = chunks.get(key), cacheRevision = 0, blockStates = new Map(), blockDefinitions = {}) {
    const blockMap = selectedChunk;
    // Neighbor revisions are supplied as a cache token when a boundary changes.
    void cacheRevision;
    if (!blockMap) {
        return {materials: new Map(), collision: {vertices: [], indices: []}};
    }

    const chunk = parseChunkKey(key);
    const materials = new Map();
    const collision = {vertices: [], indices: []};

    blockMap.forEach((blockId, index) => {
        const definition = blockDefinitions[blockId];
        if (!definition) {
            return;
        }
        const position = worldPosition(chunk, indexToLocal(index));
        const data = materials.get(blockId) ?? emptyMeshData();

        if (definition.shape === "cross") {
            addPlant(data, position);
            materials.set(blockId, data);
            return;
        }

        if (["door", "trapdoor", "ladder", "bed", "farmland"].includes(definition.shape)) {
            addCuboid(data, collision, position, shapedBounds(definition, blockStates.get(positionKey(position))), definition.solid);
            materials.set(blockId, data);
            return;
        }

        const fluidSurface = definition.fluid
            && getBlock(chunks, [position[0], position[1] + 1, position[2]]) !== blockId;

        FACES.forEach((face) => {
            if (!visibleFace(chunks, blockId, position, face.normal, blockDefinitions)) {
                return;
            }
            addFace(data, position, face, fluidSurface);

            const neighborPosition = position.map((value, axis) => value + face.normal[axis]);
            const neighborId = getBlock(chunks, neighborPosition);
            if (definition.solid && (!neighborId || !blockDefinitions[neighborId]?.solid)) {
                const corners = faceCorners(position, face);
                TRIANGLE_ORDER.forEach((cornerIndex) => {
                    collision.vertices.push(...corners[cornerIndex]);
                    collision.indices.push(collision.indices.length);
                });
            }
        });
        materials.set(blockId, data);
    });

    return {materials, collision};
}

export function voxelFromIntersection(point, normal, outside = false) {
    const axes = ["x", "y", "z"];
    const inside = axes.map((axis) => (
        Math.floor(point[axis] - normal[axis] * 0.01 + 0.5)
    ));
    return outside
        ? inside.map((coordinate, index) => coordinate + Math.round(normal[axes[index]]))
        : inside;
}
