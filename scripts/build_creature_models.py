#!/usr/bin/env python3
"""Prepare selected external creature models for browser-local loading."""

import json
import struct
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/images/assets/kenney-prototype-kit/animal-horse.glb"
TEXTURE = ROOT / "src/images/assets/kenney-prototype-kit/Textures/colormap.png"
OUTPUT = ROOT / "src/images/game/creatures/horse.glb"


def padded(data, fill=b"\0"):
    return data + fill * ((4 - len(data) % 4) % 4)


def embed_glb_texture():
    source = SOURCE.read_bytes()
    _, _, _ = struct.unpack_from("<4sII", source, 0)
    offset = 12
    chunks = {}
    while offset < len(source):
        length, chunk_type = struct.unpack_from("<II", source, offset)
        offset += 8
        chunks[chunk_type] = source[offset:offset + length]
        offset += length

    document = json.loads(chunks[0x4E4F534A].rstrip(b"\0 "))
    binary = bytearray(chunks.get(0x004E4942, b""))
    while len(binary) % 4:
        binary.append(0)
    texture = TEXTURE.read_bytes()
    document.setdefault("bufferViews", []).append({
        "buffer": 0,
        "byteOffset": len(binary),
        "byteLength": len(texture),
    })
    binary.extend(texture)
    document["images"][0] = {
        "bufferView": len(document["bufferViews"]) - 1,
        "mimeType": "image/png",
    }
    document["buffers"][0]["byteLength"] = len(binary)

    json_chunk = padded(json.dumps(document, separators=(",", ":")).encode(), b" ")
    binary_chunk = padded(bytes(binary))
    total = 12 + 8 + len(json_chunk) + 8 + len(binary_chunk)
    output = bytearray(struct.pack("<4sII", b"glTF", 2, total))
    output.extend(struct.pack("<II", len(json_chunk), 0x4E4F534A))
    output.extend(json_chunk)
    output.extend(struct.pack("<II", len(binary_chunk), 0x004E4942))
    output.extend(binary_chunk)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_bytes(output)


if __name__ == "__main__":
    embed_glb_texture()
