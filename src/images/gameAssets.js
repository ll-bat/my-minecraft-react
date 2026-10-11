import {
    ClampToEdgeWrapping,
    LinearMipmapLinearFilter,
    NearestFilter,
    sRGBEncoding,
    TextureLoader
} from "three";
import atlasMetadata from "./game/atlases/blocks.json";
import opaqueAtlas from "./game/atlases/blocks-opaque.png";
import cutoutAtlas from "./game/atlases/blocks-cutout.png";
import translucentAtlas from "./game/atlases/blocks-translucent.png";
import emissiveAtlas from "./game/atlases/blocks-emissive.png";
import itemAtlasMetadata from "./game/atlases/items.json";
import itemAtlasSource from "./game/atlases/items.png";
import barrelModel from "./game/models/barrel.gltf";
import basketModel from "./game/models/basket.gltf";
import benchModel from "./game/models/bench.gltf";
import bushModel from "./game/models/bush.gltf";
import cabinetModel from "./game/models/cabinet.gltf";
import chairModel from "./game/models/chair.gltf";
import crateModel from "./game/models/crate.gltf";
import fallenLogModel from "./game/models/fallen_log.gltf";
import floorLampModel from "./game/models/floor_lamp.gltf";
import flowerpotModel from "./game/models/flowerpot.gltf";
import hangingLanternModel from "./game/models/hanging_lantern.gltf";
import pathMarkerModel from "./game/models/path_marker.gltf";
import planterModel from "./game/models/planter.gltf";
import rockModel from "./game/models/rock.gltf";
import rugModel from "./game/models/rug.gltf";
import shelfModel from "./game/models/shelf.gltf";
import signModel from "./game/models/sign.gltf";
import stoolModel from "./game/models/stool.gltf";
import tableModel from "./game/models/wood_table.gltf";
import wallArtModel from "./game/models/wall_art.gltf";

const BLOCK_ATLAS_SOURCES = {
    opaque: opaqueAtlas,
    cutout: cutoutAtlas,
    translucent: translucentAtlas,
    emissive: emissiveAtlas,
};

export const MODEL_SOURCES = {
    barrel: barrelModel, basket: basketModel, bench: benchModel, bush: bushModel,
    cabinet: cabinetModel, chair: chairModel, crate: crateModel, fallen_log: fallenLogModel,
    floor_lamp: floorLampModel, flowerpot: flowerpotModel, hanging_lantern: hangingLanternModel,
    path_marker: pathMarkerModel, planter: planterModel, rock: rockModel, rug: rugModel,
    shelf: shelfModel, sign: signModel, stool: stoolModel, wood_table: tableModel, wall_art: wallArtModel,
};

function loadAtlas(source) {
    const texture = new TextureLoader().load(source);
    texture.magFilter = NearestFilter;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.encoding = sRGBEncoding;
    return texture;
}

export const BLOCK_ATLASES = Object.fromEntries(Object.entries(BLOCK_ATLAS_SOURCES)
    .map(([layer, source]) => [layer, loadAtlas(source)]));
export const ITEM_ATLAS = loadAtlas(itemAtlasSource);

export const ATLAS_MATERIAL_PREFIX = "atlas:";

function atlasPreview(entry) {
    const [width, height] = atlasMetadata.layers[entry.layer].size;
    const [u0, , , v1] = entry.uv;
    return {
        source: BLOCK_ATLAS_SOURCES[entry.layer],
        width,
        height,
        x: u0 * width,
        y: (1 - v1) * height,
        size: atlasMetadata.cellSize,
    };
}

function textureForFace(textures, faceName) {
    return textures[faceName]
        ?? (!["top", "bottom"].includes(faceName) ? textures.side : null)
        ?? textures.all
        ?? Object.values(textures)[0];
}

export function blockVisual(textures, preview = null, variants = []) {
    const textureNames = Array.from(new Set([
        ...Object.values(textures),
        ...variants.flatMap((variant) => Object.values(variant)),
    ]));
    const atlasEntries = Object.fromEntries(textureNames.map((name) => [name, atlasMetadata.entries[name]]));
    const firstName = preview ?? textures.all ?? textures.side ?? textures.north ?? textures.top ?? textureNames[0];
    return {
        textures,
        variants,
        atlasEntries,
        atlasPreview: atlasPreview(atlasEntries[firstName]),
        atlasPreviews: Object.fromEntries(["top", "north", "east"].map((faceName) => {
            const textureName = textureForFace(textures, faceName);
            return [faceName, atlasPreview(atlasEntries[textureName])];
        })),
    };
}

export function itemArtwork(itemId) {
    const entry = itemAtlasMetadata.entries[itemId];
    if (!entry) return null;
    return {
        source: itemAtlasSource,
        texture: ITEM_ATLAS,
        atlasSize: itemAtlasMetadata.size,
        ...entry,
    };
}

export function modelVisual(modelId) {
    return {
        modelId,
        modelUrl: MODEL_SOURCES[modelId],
        modelPreview: itemArtwork(`model_${modelId}`),
    };
}

export function blockTextureName(block, faceName) {
    const textures = block?.textures;
    if (!textures) return null;
    if (textures[faceName]) return textures[faceName];
    if (!["top", "bottom"].includes(faceName) && textures.side) return textures.side;
    return textures.all ?? null;
}

export function blockAtlasEntry(block, faceName = "south") {
    const textureName = blockTextureName(block, faceName);
    return textureName ? block.atlasEntries?.[textureName] ?? null : null;
}

export function atlasMaterialDefinition(key) {
    if (!key.startsWith(ATLAS_MATERIAL_PREFIX)) return null;
    const [layer, animation = null] = key.slice(ATLAS_MATERIAL_PREFIX.length).split(":");
    return {layer, animation, texture: BLOCK_ATLASES[layer]};
}
