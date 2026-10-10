function smooth(value) {
    return value * value * (3 - 2 * value);
}

function mix(from, to, amount) {
    return from + (to - from) * amount;
}

export function seedToNumber(seed) {
    const text = String(seed).trim() || "minecraft-react";
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

export function randomAt(seed, x, y = 0, z = 0) {
    let hash = seed >>> 0;
    hash ^= Math.imul(x, 374761393);
    hash ^= Math.imul(y, 668265263);
    hash ^= Math.imul(z, 2147483647);
    hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
    return ((hash ^ (hash >>> 16)) >>> 0) / 4294967295;
}

export function valueNoise2D(seed, x, z) {
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const tx = smooth(x - x0);
    const tz = smooth(z - z0);
    const top = mix(randomAt(seed, x0, 0, z0), randomAt(seed, x0 + 1, 0, z0), tx);
    const bottom = mix(randomAt(seed, x0, 0, z0 + 1), randomAt(seed, x0 + 1, 0, z0 + 1), tx);
    return mix(top, bottom, tz) * 2 - 1;
}

export function valueNoise3D(seed, x, y, z) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const z0 = Math.floor(z);
    const tx = smooth(x - x0);
    const ty = smooth(y - y0);
    const tz = smooth(z - z0);

    const layer = (layerY) => {
        const top = mix(
            randomAt(seed, x0, layerY, z0),
            randomAt(seed, x0 + 1, layerY, z0),
            tx
        );
        const bottom = mix(
            randomAt(seed, x0, layerY, z0 + 1),
            randomAt(seed, x0 + 1, layerY, z0 + 1),
            tx
        );
        return mix(top, bottom, tz);
    };

    return (mix(layer(y0), layer(y0 + 1), ty) * 2) - 1;
}

export function fractalNoise2D(seed, x, z, scale, octaves = 4) {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let totalAmplitude = 0;

    for (let octave = 0; octave < octaves; octave += 1) {
        value += valueNoise2D(
            seed + octave * 1013,
            (x / scale) * frequency,
            (z / scale) * frequency
        ) * amplitude;
        totalAmplitude += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }

    return value / totalAmplitude;
}

export function fractalNoise3D(seed, x, y, z, scale, octaves = 3) {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let totalAmplitude = 0;

    for (let octave = 0; octave < octaves; octave += 1) {
        value += valueNoise3D(
            seed + octave * 2017,
            (x / scale) * frequency,
            (y / scale) * frequency,
            (z / scale) * frequency
        ) * amplitude;
        totalAmplitude += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }

    return value / totalAmplitude;
}
