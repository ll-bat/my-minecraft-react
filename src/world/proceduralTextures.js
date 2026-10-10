import {
    DataTexture,
    NearestFilter,
    RGBAFormat,
    RepeatWrapping,
    UnsignedByteType
} from "three";

function colorChannels(hex) {
    const value = Number.parseInt(hex.replace("#", ""), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function finishTexture(data) {
    const texture = new DataTexture(data, 16, 16, RGBAFormat, UnsignedByteType);
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
}

export function createBlockTexture(baseHex, accentHex, accentRate = 0.2) {
    const base = colorChannels(baseHex);
    const accent = colorChannels(accentHex);
    const data = new Uint8Array(16 * 16 * 4);

    for (let pixel = 0; pixel < 256; pixel += 1) {
        const pseudoRandom = ((pixel * 73 + pixel * pixel * 19) % 101) / 100;
        const color = pseudoRandom < accentRate ? accent : base;
        const offset = pixel * 4;
        data[offset] = color[0];
        data[offset + 1] = color[1];
        data[offset + 2] = color[2];
        data[offset + 3] = 255;
    }

    return finishTexture(data);
}

export function createPlantTexture(stemHex, flowerHex = null) {
    const stem = colorChannels(stemHex);
    const flower = flowerHex ? colorChannels(flowerHex) : stem;
    const data = new Uint8Array(16 * 16 * 4);

    for (let y = 0; y < 16; y += 1) {
        for (let x = 0; x < 16; x += 1) {
            const isStem = y < 11 && Math.abs(x - 8) <= (y < 5 ? 0 : 1);
            const isLeaf = y >= 4 && y <= 10 && Math.abs(x - 8) === 2;
            const isFlower = flowerHex && y >= 10 && Math.abs(x - 8) <= 3;
            if (!isStem && !isLeaf && !isFlower) {
                continue;
            }

            const color = isFlower ? flower : stem;
            const offset = (y * 16 + x) * 4;
            data[offset] = color[0];
            data[offset + 1] = color[1];
            data[offset + 2] = color[2];
            data[offset + 3] = 255;
        }
    }

    return finishTexture(data);
}

export function createFramedWindowTexture() {
    const frame = colorChannels("#81552f");
    const frameLight = colorChannels("#c18a4d");
    const glass = colorChannels("#bde8ef");
    const data = new Uint8Array(16 * 16 * 4);
    for (let y = 0; y < 16; y += 1) {
        for (let x = 0; x < 16; x += 1) {
            const border = x < 2 || x > 13 || y < 2 || y > 13;
            const highlight = border && (x === 2 || y === 13);
            const color = border ? (highlight ? frameLight : frame) : glass;
            const offset = (y * 16 + x) * 4;
            data[offset] = color[0]; data[offset + 1] = color[1]; data[offset + 2] = color[2];
            data[offset + 3] = border ? 255 : (x === 4 + Math.floor(y / 3) ? 95 : 42);
        }
    }
    return finishTexture(data);
}

export function createDoorTexture(part = "bottom") {
    const wood = colorChannels("#9b6030");
    const light = colorChannels("#cf9251");
    const dark = colorChannels("#4e2c18");
    const glass = colorChannels("#8bcbd5");
    const data = new Uint8Array(16 * 16 * 4);
    for (let y = 0; y < 16; y += 1) {
        for (let x = 0; x < 16; x += 1) {
            const edge = x < 2 || x > 13 || y < 1 || y > 14;
            const panelLine = x === 4 || x === 11 || y === 4 || y === 11;
            const upperWindow = part === "top" && x > 4 && x < 11 && y > 5 && y < 13;
            const handle = part === "bottom" && x >= 11 && x <= 12 && y >= 8 && y <= 9;
            const color = handle ? light : upperWindow ? glass : edge ? dark : panelLine ? light : wood;
            const offset = (y * 16 + x) * 4;
            data[offset] = color[0]; data[offset + 1] = color[1]; data[offset + 2] = color[2]; data[offset + 3] = 255;
        }
    }
    return finishTexture(data);
}
