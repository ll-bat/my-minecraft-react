#!/usr/bin/env python3
"""Validate generated visual assets, provenance, and atlas padding."""

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / "src/images/game"
ATLAS_DIR = GAME / "atlases"


def require(condition, message):
    if not condition:
        raise SystemExit(message)


def validate_manifest():
    manifest = json.loads((GAME / "manifest.json").read_text())
    ids = [entry["id"] for entry in manifest["entries"]]
    require(len(ids) == len(set(ids)), "manifest contains duplicate IDs")
    for entry in manifest["entries"]:
        require((ROOT / entry["output"]).is_file(), f"missing generated output: {entry['output']}")
        if entry["source"] != "project-generated":
            require((ROOT / entry["source"]).is_file(), f"missing source asset: {entry['source']}")
    license_text = (ROOT / "src/images/assets/kenney-voxel-pack/LICENSE.txt").read_text().lower()
    require("creative commons" in license_text and "cc0" in license_text, "Kenney CC0 license file is missing or invalid")
    return len(manifest["entries"])


def validate_atlases():
    metadata = json.loads((ATLAS_DIR / "blocks.json").read_text())
    padding = metadata["padding"]
    cell = metadata["cellSize"]
    atlases = {layer: Image.open(ATLAS_DIR / info["file"]).convert("RGBA") for layer, info in metadata["layers"].items()}
    for layer, image in atlases.items():
        width, height = image.size
        require(width & (width - 1) == 0 and height & (height - 1) == 0, f"{layer} atlas is not power-of-two")
    for name, entry in metadata["entries"].items():
        image = atlases[entry["layer"]]
        width, height = image.size
        u0, v0, u1, v1 = entry["uv"]
        left = round(u0 * width)
        right = round(u1 * width) - 1
        top = round((1 - v1) * height)
        bottom = round((1 - v0) * height) - 1
        require(right - left + 1 == cell and bottom - top + 1 == cell, f"invalid atlas cell for {name}")
        for offset in range(1, padding + 1):
            for y in range(top, bottom + 1):
                require(image.getpixel((left - offset, y)) == image.getpixel((left, y)), f"left padding bleed risk: {name}")
                require(image.getpixel((right + offset, y)) == image.getpixel((right, y)), f"right padding bleed risk: {name}")
            for x in range(left, right + 1):
                require(image.getpixel((x, top - offset)) == image.getpixel((x, top)), f"top padding bleed risk: {name}")
                require(image.getpixel((x, bottom + offset)) == image.getpixel((x, bottom)), f"bottom padding bleed risk: {name}")
    return len(metadata["entries"]), len(atlases)


def main():
    manifest_count = validate_manifest()
    texture_count, atlas_count = validate_atlases()
    print(f"Validated {texture_count} textures in {atlas_count} padded atlases and {manifest_count} provenance records")


if __name__ == "__main__":
    main()
