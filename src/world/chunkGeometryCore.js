import {getBlock, indexToLocal, parseChunkKey, worldPosition} from "./chunks";
import {positionKey} from "./coordinates";
import {isPartialShape, rotateBounds, shapeParts} from "./blockShapes";
import {randomAt, seedToNumber} from "./noise";
import {biomeAt, BIOMES} from "./terrain";

const FACES = [
    {name: "east", normal: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0]},
    {name: "west", normal: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0]},
    {name: "top", normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1]},
    {name: "bottom", normal: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1]},
    {name: "south", normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0]},
    {name: "north", normal: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0]},
];

const TRIANGLE_ORDER = [0, 1, 2, 0, 2, 3];
const UVS = [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1];

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

function faceUvs(rect = null) {
    if (!rect) return UVS;
    const [u0, v0, u1, v1] = rect;
    return [u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1];
}

function localFaceName(faceName, facing = "north") {
    if (["top", "bottom"].includes(faceName) || facing === "north") return faceName;
    const rotations = {
        south: {north: "south", south: "north", east: "west", west: "east"},
        east: {east: "north", south: "east", west: "south", north: "west"},
        west: {west: "north", north: "east", east: "south", south: "west"},
    };
    return rotations[facing]?.[faceName] ?? faceName;
}

function texturesAt(definition, position, worldSeed) {
    if (!definition.variants?.length) return definition.textures;
    const options = [definition.textures, ...definition.variants];
    const index = Math.floor(randomAt(seedToNumber(worldSeed) + 24001, ...position) * options.length);
    return options[Math.min(index, options.length - 1)];
}

function textureForFace(definition, faceName, state = {}, position = [0, 0, 0], worldSeed = "") {
    const textures = texturesAt(definition, position, worldSeed);
    if (!textures) return null;
    const localName = localFaceName(faceName, state.facing);
    if (textures[localName]) return textures[localName];
    if (!["top", "bottom"].includes(localName) && textures.side) return textures.side;
    return textures.all ?? null;
}

function faceMaterial(blockId, definition, faceName, state = {}, position, worldSeed) {
    const textureName = textureForFace(definition, faceName, state, position, worldSeed);
    const entry = textureName ? definition.atlasEntries?.[textureName] : null;
    const translucentGroup = entry?.layer === "translucent"
        ? `:${definition.animation ?? "static"}:${blockId}`
        : definition.animation ? `:${definition.animation}` : "";
    return entry
        ? {key: `atlas:${entry.layer}${translucentGroup}`, uv: entry.uv, layer: entry.layer}
        : {key: blockId, uv: null};
}

function blockTint(definition, position, worldSeed, faceName = "side") {
    if (!definition.biomeTint) return [1, 1, 1];
    const faceGroup = ["top", "bottom"].includes(faceName) ? faceName : "side";
    if (definition.biomeTintFaces && !definition.biomeTintFaces.includes(faceGroup)) return [1, 1, 1];
    const biome = biomeAt(worldSeed, position[0], position[2]);
    if (definition.biomeTint === "water") {
        return biome === BIOMES.DESERT ? [0.86, 1, 1.08]
            : biome === BIOMES.FOREST ? [0.76, 0.96, 0.9]
                : biome === BIOMES.MOUNTAINS ? [0.8, 0.92, 1.08] : [0.86, 0.98, 1.05];
    }
    return biome === BIOMES.DESERT ? [0.88, 0.88, 0.58]
        : biome === BIOMES.FOREST ? [0.72, 1.04, 0.7]
            : biome === BIOMES.MOUNTAINS ? [0.8, 0.94, 0.76] : [0.88, 1, 0.78];
}

function appendFaceColors(data, face, tint) {
    const shade = face.name === "top" ? 1 : face.name === "bottom" ? 0.62
        : face.name === "south" ? 0.9 : face.name === "north" ? 0.76 : face.name === "east" ? 0.84 : 0.8;
    for (let vertex = 0; vertex < 6; vertex += 1) data.colors.push(...tint.map((channel) => channel * shade));
}

function materialData(materials, key) {
    const data = materials.get(key) ?? emptyMeshData();
    materials.set(key, data);
    return data;
}

function appendTextureCoordinates(data, rect = null, width = 1, height = 1) {
    data.uvs.push(...faceUvs(rect));
    data.tileUvs.push(0, 0, width, 0, width, height, 0, 0, width, height, 0, height);
    const atlasRect = rect ?? [0, 0, 1, 1];
    for (let vertex = 0; vertex < 6; vertex += 1) data.atlasRects.push(...atlasRect);
}

function addFace(data, position, face, fluid = false, uv = null, tint = [1, 1, 1]) {
    const corners = faceCorners(position, face, fluid);
    TRIANGLE_ORDER.forEach((cornerIndex) => {
        data.positions.push(...corners[cornerIndex]);
        data.normals.push(...face.normal);
    });
    appendTextureCoordinates(data, uv);
    appendFaceColors(data, face, tint);
}

function addPlant(data, [x, y, z], uv = null, tint = [1, 1, 1]) {
    const planes = [
        [[x - 0.5, y - 0.5, z - 0.5], [x + 0.5, y - 0.5, z + 0.5], [x + 0.5, y + 0.5, z + 0.5], [x - 0.5, y + 0.5, z - 0.5]],
        [[x + 0.5, y - 0.5, z - 0.5], [x - 0.5, y - 0.5, z + 0.5], [x - 0.5, y + 0.5, z + 0.5], [x + 0.5, y + 0.5, z - 0.5]],
    ];

    planes.forEach((corners) => {
        TRIANGLE_ORDER.forEach((cornerIndex) => {
            data.positions.push(...corners[cornerIndex]);
            data.normals.push(0, 1, 0);
        });
        appendTextureCoordinates(data, uv);
        for (let vertex = 0; vertex < 6; vertex += 1) data.colors.push(...tint);
    });
}

function addCuboid(materials, collision, blockId, definition, state, [x, y, z], bounds, solid, worldSeed) {
    const [minX, maxX, minY, maxY, minZ, maxZ] = bounds;
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const midZ = (minZ + maxZ) / 2;
    const centers = [
        [x + maxX, y + midY, z + midZ], [x + minX, y + midY, z + midZ], [x + midX, y + maxY, z + midZ],
        [x + midX, y + minY, z + midZ], [x + midX, y + midY, z + maxZ], [x + midX, y + midY, z + minZ],
    ];
    FACES.forEach((face, faceIndex) => {
        const material = faceMaterial(blockId, definition, face.name, state, [x, y, z], worldSeed);
        const data = materialData(materials, material.key);
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
        appendTextureCoordinates(data, material.uv);
        appendFaceColors(data, face, blockTint(definition, [x, y, z], worldSeed, face.name));
    });
}

function faceAxes(face) {
    const normalAxis = face.normal.findIndex((value) => value !== 0);
    const uAxis = face.u.findIndex((value) => value !== 0);
    const vAxis = face.v.findIndex((value) => value !== 0);
    return {normalAxis, uAxis, vAxis};
}

function addMergedFace(data, collision, face, cells, width, height, uv, tint, solidCollision) {
    const {normalAxis, uAxis, vAxis} = faceAxes(face);
    const origin = cells[0].position;
    const center = [...origin];
    center[normalAxis] += face.normal[normalAxis] * 0.5;
    center[uAxis] = cells[0].u + (width - 1) / 2;
    center[vAxis] = cells[0].v + (height - 1) / 2;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [
        center[0] + face.u[0] * u * width / 2 + face.v[0] * v * height / 2,
        center[1] + face.u[1] * u * width / 2 + face.v[1] * v * height / 2,
        center[2] + face.u[2] * u * width / 2 + face.v[2] * v * height / 2,
    ]);
    TRIANGLE_ORDER.forEach((cornerIndex) => {
        data.positions.push(...corners[cornerIndex]);
        data.normals.push(...face.normal);
        if (solidCollision) {
            collision.vertices.push(...corners[cornerIndex]);
            collision.indices.push(collision.indices.length);
        }
    });
    appendTextureCoordinates(data, uv, width, height);
    appendFaceColors(data, face, tint);
}

function flushGreedyFaces(materials, collision, candidates) {
    candidates.forEach((groups, faceName) => {
        const face = FACES.find((entry) => entry.name === faceName);
        groups.forEach((cells) => {
            const pending = new Map(cells.map((cell) => [`${cell.u},${cell.v}`, cell]));
            while (pending.size) {
                const first = pending.values().next().value;
                let width = 1;
                while (pending.get(`${first.u + width},${first.v}`)?.signature === first.signature) width += 1;
                let height = 1;
                while (true) {
                    const nextV = first.v + height;
                    let complete = true;
                    for (let offset = 0; offset < width; offset += 1) {
                        if (pending.get(`${first.u + offset},${nextV}`)?.signature !== first.signature) {
                            complete = false;
                            break;
                        }
                    }
                    if (!complete) break;
                    height += 1;
                }
                const merged = [];
                for (let v = 0; v < height; v += 1) {
                    for (let u = 0; u < width; u += 1) {
                        const key = `${first.u + u},${first.v + v}`;
                        merged.push(pending.get(key));
                        pending.delete(key);
                    }
                }
                const data = materialData(materials, first.materialKey);
                addMergedFace(data, collision, face, merged, width, height, first.uv, first.tint, first.solidCollision);
            }
        });
    });
}

function addCollisionCuboid(collision, [x, y, z], bounds) {
    const [minX, maxX, minY, maxY, minZ, maxZ] = bounds;
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const midZ = (minZ + maxZ) / 2;
    const centers = [
        [x + maxX, y + midY, z + midZ], [x + minX, y + midY, z + midZ],
        [x + midX, y + maxY, z + midZ], [x + midX, y + minY, z + midZ],
        [x + midX, y + midY, z + maxZ], [x + midX, y + midY, z + minZ],
    ];
    FACES.forEach((face, faceIndex) => {
        const uScale = face.u[0] ? maxX - minX : face.u[1] ? maxY - minY : maxZ - minZ;
        const vScale = face.v[0] ? maxX - minX : face.v[1] ? maxY - minY : maxZ - minZ;
        const corners = [[-1,-1],[1,-1],[1,1],[-1,1]].map(([u, v]) => centers[faceIndex].map((value, axis) => (
            value + face.u[axis] * u * uScale / 2 + face.v[axis] * v * vScale / 2
        )));
        TRIANGLE_ORDER.forEach((cornerIndex) => {
            collision.vertices.push(...corners[cornerIndex]);
            collision.indices.push(collision.indices.length);
        });
    });
}

function occludesNeighborFace(definition) {
    return definition.solid && !definition.transparent && definition.shape !== "cross" && !isPartialShape(definition.shape);
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
    return {positions: [], normals: [], uvs: [], colors: [], tileUvs: [], atlasRects: []};
}

export function buildChunkMeshDataCore(chunks, key, selectedChunk = chunks.get(key), cacheRevision = 0, blockStates = new Map(), blockDefinitions = {}, worldSeed = "minecraft-react") {
    const blockMap = selectedChunk;
    // Neighbor revisions are supplied as a cache token when a boundary changes.
    void cacheRevision;
    if (!blockMap) {
        return {materials: new Map(), collision: {vertices: [], indices: []}};
    }

    const chunk = parseChunkKey(key);
    const materials = new Map();
    const collision = {vertices: [], indices: []};
    const greedyCandidates = new Map();

    blockMap.forEach((blockId, index) => {
        const definition = blockDefinitions[blockId];
        if (!definition) {
            return;
        }
        const position = worldPosition(chunk, indexToLocal(index));
        const blockState = blockStates.get(positionKey(position)) ?? {};
        if (definition.shape === "cross") {
            const material = faceMaterial(blockId, definition, "side", blockState, position, worldSeed);
            addPlant(materialData(materials, material.key), position, material.uv, blockTint(definition, position, worldSeed));
            return;
        }

        if (definition.shape === "model") {
            if (definition.solid) {
                const bounds = definition.collisionBounds ?? [-0.45, 0.45, -0.5, 0.5, -0.45, 0.45];
                addCollisionCuboid(collision, position, rotateBounds(bounds, blockState.facing));
            }
            return;
        }

        if (isPartialShape(definition.shape)) {
            const neighborAt = (offset) => {
                const neighborId = getBlock(chunks, position.map((value, axis) => value + offset[axis]));
                return blockDefinitions[neighborId];
            };
            shapeParts(definition, blockState, neighborAt).forEach((bounds) => {
                addCuboid(materials, collision, blockId, definition, blockState, position, bounds, definition.solid, worldSeed);
            });
            return;
        }

        const fluidSurface = definition.fluid
            && getBlock(chunks, [position[0], position[1] + 1, position[2]]) !== blockId;

        FACES.forEach((face) => {
            if (!visibleFace(chunks, blockId, position, face.normal, blockDefinitions)) {
                return;
            }
            const material = faceMaterial(blockId, definition, face.name, blockState, position, worldSeed);
            const neighborPosition = position.map((value, axis) => value + face.normal[axis]);
            const neighborId = getBlock(chunks, neighborPosition);
            const solidCollision = definition.solid && (!neighborId || !blockDefinitions[neighborId]?.solid);
            const tint = blockTint(definition, position, worldSeed, face.name);
            const greedy = material.layer === "opaque" && !definition.transparent && !definition.fluid && !definition.animation;
            if (greedy) {
                const {normalAxis, uAxis, vAxis} = faceAxes(face);
                const plane = position[normalAxis];
                const signature = JSON.stringify([material.key, material.uv, tint, solidCollision]);
                const faceGroups = greedyCandidates.get(face.name) ?? new Map();
                const groupKey = `${plane}:${signature}`;
                const cells = faceGroups.get(groupKey) ?? [];
                cells.push({position, u: position[uAxis], v: position[vAxis], signature, materialKey: material.key, uv: material.uv, tint, solidCollision});
                faceGroups.set(groupKey, cells);
                greedyCandidates.set(face.name, faceGroups);
                return;
            }
            addFace(materialData(materials, material.key), position, face, fluidSurface, material.uv, tint);

            if (solidCollision) {
                const corners = faceCorners(position, face);
                TRIANGLE_ORDER.forEach((cornerIndex) => {
                    collision.vertices.push(...corners[cornerIndex]);
                    collision.indices.push(collision.indices.length);
                });
            }
        });
    });

    flushGreedyFaces(materials, collision, greedyCandidates);

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
