#!/usr/bin/env python3
"""Embed Kenney's shared colormap into self-contained game-ready watercraft GLBs."""

import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/images/assets/kenney-watercraft-kit"
OUTPUT = ROOT / "src/images/game/vehicles"
MODELS = ("boat-row-large.glb", "ship-small.glb")
JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942


def padded(data, fill=b"\0"):
    return data + fill * ((-len(data)) % 4)


def read_glb(path):
    data = path.read_bytes()
    magic, version, total_length = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67 or version != 2 or total_length != len(data):
        raise ValueError(f"Invalid GLB header: {path}")
    offset, chunks = 12, {}
    while offset < len(data):
        length, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        chunks[chunk_type] = data[offset:offset + length]
        offset += length
    document = json.loads(chunks[JSON_CHUNK].decode("utf8").rstrip("\0 "))
    return document, chunks[BIN_CHUNK]


def write_glb(path, document, binary):
    json_data = padded(json.dumps(document, separators=(",", ":")).encode("utf8"), b" ")
    binary = padded(binary)
    total_length = 12 + 8 + len(json_data) + 8 + len(binary)
    output = bytearray(struct.pack("<III", 0x46546C67, 2, total_length))
    output.extend(struct.pack("<II", len(json_data), JSON_CHUNK))
    output.extend(json_data)
    output.extend(struct.pack("<II", len(binary), BIN_CHUNK))
    output.extend(binary)
    path.write_bytes(output)


def embed_texture(source_path, output_path, texture):
    document, binary_chunk = read_glb(source_path)
    declared_length = document["buffers"][0]["byteLength"]
    binary = bytearray(binary_chunk[:declared_length])
    binary.extend(b"\0" * ((-len(binary)) % 4))
    image_offset = len(binary)
    binary.extend(texture)
    image_view = len(document.get("bufferViews", []))
    document.setdefault("bufferViews", []).append({
        "buffer": 0,
        "byteOffset": image_offset,
        "byteLength": len(texture),
    })
    document["images"] = [{
        "bufferView": image_view,
        "mimeType": "image/png",
        "name": "colormap",
    }]
    document["buffers"][0]["byteLength"] = len(binary)
    write_glb(output_path, document, binary)

    verified, verified_binary = read_glb(output_path)
    image = verified["images"][0]
    view = verified["bufferViews"][image["bufferView"]]
    if "uri" in image or image.get("mimeType") != "image/png":
        raise ValueError(f"Texture was not embedded in {output_path}")
    if view["byteOffset"] + view["byteLength"] > len(verified_binary):
        raise ValueError(f"Embedded texture exceeds the binary chunk in {output_path}")


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    texture = (SOURCE / "colormap.png").read_bytes()
    for filename in MODELS:
        embed_texture(SOURCE / filename, OUTPUT / filename, texture)
    print(f"Built {len(MODELS)} self-contained watercraft GLBs")


if __name__ == "__main__":
    main()
