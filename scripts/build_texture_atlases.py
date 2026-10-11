#!/usr/bin/env python3
"""Build reproducible block and item atlases from source and project art."""

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "src/images/assets/kenney-voxel-pack"
FISH_ASSETS = ROOT / "src/images/assets/kenney-fish-pack"
SOURCE, ITEM_SOURCE = ASSETS / "tiles", ASSETS / "items"
GAME = ROOT / "src/images/game"
BLOCKS, ITEMS, ATLASES = GAME / "blocks", GAME / "items", GAME / "atlases"
MODEL_PREVIEWS = GAME / "models/previews"
SOURCE_SIZE, PADDING, COLUMNS = 128, 2, 8
CONTENT_SIZE = SOURCE_SIZE - PADDING * 2

TEXTURES = {
    "bedrock": ("greystone.png", "opaque", "bedrock"), "brick_gray": ("brick_grey.png", "opaque", None),
    "brick_red": ("brick_red.png", "opaque", None), "cactus_bottom": ("cactus_inside.png", "opaque", None),
    "cactus_side": ("cactus_side.png", "opaque", None), "cactus_top": ("cactus_top.png", "opaque", None),
    "coal_ore": ("stone_coal.png", "opaque", None), "coal_ore_variant": ("stone_coal.png", "opaque", "variant_cool"),
    "copper_ore": ("stone_browniron.png", "opaque", None), "copper_ore_variant": ("stone_browniron.png", "opaque", "variant_warm"),
    "crystal_block": ("ice.png", "emissive", "crystal"), "crystal_ore": ("stone_diamond.png", "emissive", "crystal"),
    "crystal_ore_variant": ("stone_diamond.png", "emissive", "crystal_variant"),
    "dirt": ("dirt.png", "opaque", None), "farmland": ("dirt.png", "opaque", "farmland"),
    "dirt_variant": ("dirt.png", "opaque", "variant_warm"),
    "glass": ("glass.png", "translucent", None), "glass_frame": ("glass_frame.png", "translucent", None),
    "gold_ore": ("stone_gold.png", "opaque", None), "gold_ore_variant": ("stone_gold.png", "opaque", "variant_warm"),
    "grass_plant": ("grass1.png", "cutout", None),
    "grass_side": ("dirt_grass.png", "opaque", None), "grass_top": ("grass_top.png", "opaque", None),
    "grass_side_variant": ("dirt_grass.png", "opaque", "variant_cool"), "grass_top_variant": ("grass_top.png", "opaque", "variant_cool"),
    "gravel": ("gravel_stone.png", "opaque", None), "ice": ("ice.png", "translucent", None),
    "iron_ore": ("stone_silver.png", "opaque", None), "iron_ore_variant": ("stone_silver.png", "opaque", "variant_cool"),
    "lava": ("lava.png", "emissive", None),
    "leaves": ("leaves_transparent.png", "cutout", None), "log_end": ("trunk_top.png", "opaque", None),
    "leaves_variant": ("leaves_transparent.png", "cutout", "variant_warm"),
    "log_side": ("trunk_side.png", "opaque", None), "mossy_stone": ("rock_moss.png", "opaque", None),
    "obsidian": ("greystone.png", "opaque", "obsidian"), "oven": ("oven.png", "opaque", None),
    "pale_log_end": ("trunk_white_top.png", "opaque", None), "pale_log_side": ("trunk_white_side.png", "opaque", None),
    "pale_wood": ("wood.png", "opaque", "pale_wood"), "polished_stone": ("greystone.png", "opaque", None),
    "red_wood": ("wood_red.png", "opaque", None), "sand": ("sand.png", "opaque", None),
    "sand_variant": ("sand.png", "opaque", "variant_warm"),
    "snow": ("snow.png", "opaque", None), "stone": ("stone.png", "opaque", None),
    "stone_variant": ("stone.png", "opaque", "variant_cool"),
    "table": ("table.png", "opaque", None), "water": ("water.png", "translucent", "water"),
    "wheat_0": ("wheat_stage1.png", "cutout", None), "wheat_1": ("wheat_stage2.png", "cutout", None),
    "wheat_2": ("wheat_stage3.png", "cutout", None), "wheat_3": ("wheat_stage4.png", "cutout", None),
    "wood": ("wood.png", "opaque", None),
}

CUSTOM_TEXTURE_LAYERS = {
    "bed_end": "opaque", "bed_frame": "opaque", "bed_side": "opaque", "bed_top": "opaque",
    "chest_front": "opaque", "chest_side": "opaque", "chest_top": "opaque",
    "crafting_front": "opaque", "crafting_side": "opaque", "crafting_top": "opaque",
    "door_bottom": "opaque", "door_top": "opaque", "enchanting_front": "emissive",
    "enchanting_side": "emissive", "enchanting_top": "emissive", "furnace_side": "opaque",
    "furnace_top": "opaque", "ladder": "cutout", "lamp_off": "opaque", "lamp_on": "emissive",
    "lantern": "emissive", "portal": "emissive", "torch": "emissive", "trapdoor": "cutout", "window": "translucent",
}

ITEM_TEXTURES = {
    "coal": ("ore_coal.png", None), "seeds": ("seed.png", None), "wheat": ("wheat.png", None),
    "wooden_axe": ("axe_bronze.png", "wooden_tool"), "wooden_hoe": ("hoe_bronze.png", "wooden_tool"),
    "wooden_pickaxe": ("pick_bronze.png", "wooden_tool"), "wooden_shovel": ("shovel_bronze.png", "wooden_tool"),
    "stone_axe": ("axe_iron.png", "stone_tool"), "stone_pickaxe": ("pick_iron.png", "stone_tool"),
    "stone_shovel": ("shovel_iron.png", "stone_tool"),
}
CUSTOM_ITEMS = ["stick", "iron_ingot", "copper_ingot", "gold_ingot", "crystal", "spawn_sheep", "spawn_rabbit", "spawn_glow_sprite"]
FISH_ITEMS = {
    "spawn_fish_blue": "fish_blue.png",
    "spawn_fish_orange": "fish_orange.png",
    "spawn_fish_pink": "fish_pink.png",
}


def transform(image, operation):
    image = image.convert("RGBA")
    if operation == "water": image.putalpha(Image.new("L", image.size, 168))
    elif operation == "bedrock": image = ImageEnhance.Brightness(ImageOps.grayscale(image).convert("RGBA")).enhance(0.48)
    elif operation == "farmland": image = ImageEnhance.Brightness(image).enhance(0.62)
    elif operation == "pale_wood": image = ImageOps.colorize(ImageOps.grayscale(image), "#8b704a", "#ead5a0").convert("RGBA")
    elif operation == "obsidian": image = ImageOps.colorize(ImageOps.grayscale(image), "#120d20", "#68498b").convert("RGBA")
    elif operation in ("crystal", "crystal_variant"):
        image.putdata([(int(45 + 80 * ((r + g + b) / 765)), int(155 + 90 * ((r + g + b) / 765)), int(175 + 78 * ((r + g + b) / 765)), a) for r, g, b, a in image.getdata()])
        if operation == "crystal_variant":
            image = ImageEnhance.Brightness(image).enhance(0.88)
    elif operation in ("wooden_tool", "stone_tool"):
        gray = ImageOps.grayscale(image); colors = ("#4c301c", "#c28a4e") if operation == "wooden_tool" else ("#34383c", "#b7bdbe")
        tinted = ImageOps.colorize(gray, *colors).convert("RGBA"); tinted.putalpha(image.getchannel("A")); image = tinted
    elif operation in ("variant_warm", "variant_cool"):
        overlay = Image.new("RGBA", image.size, (132, 88, 40, 28) if operation == "variant_warm" else (54, 94, 104, 24))
        alpha = image.getchannel("A"); image = Image.alpha_composite(image, overlay); image.putalpha(alpha)
    return image


def pixel_art(): return Image.new("RGBA", (16, 16), (0, 0, 0, 0))
def upscale(image): return image.resize((SOURCE_SIZE, SOURCE_SIZE), Image.Resampling.NEAREST)
def power_of_two(value): return 1 << (value - 1).bit_length()


def custom_block(name):
    im = pixel_art(); d = ImageDraw.Draw(im)
    wood, light, dark, metal = "#9a6031", "#d49a58", "#4b2d1b", "#d5ba72"
    if name.startswith("crafting_"):
        d.rectangle((0, 0, 15, 15), fill=wood); d.rectangle((0, 0, 15, 1), fill=light)
        if name == "crafting_top":
            d.rectangle((1, 1, 14, 14), outline=dark, width=2); d.line((8, 2, 8, 13), fill=dark); d.line((2, 8, 13, 8), fill=dark)
            d.rectangle((3, 3, 6, 6), fill="#c68b4a"); d.rectangle((9, 9, 12, 12), fill="#6d4325")
        else:
            for y in (5, 10): d.line((1, y, 14, y), fill=dark)
            if name == "crafting_front": d.line((4, 3, 11, 12), fill=metal, width=2); d.rectangle((3, 2, 6, 5), fill="#53616a")
    elif name.startswith("furnace_"):
        d.rectangle((0, 0, 15, 15), fill="#777a78")
        for y in (0, 5, 10, 15): d.line((0, y, 15, y), fill="#4a4d4d")
        for y in (2, 7, 12):
            for x in range(0 if y % 2 else 4, 16, 8): d.line((x, y - 2, x, min(15, y + 3)), fill="#9a9d98")
        if name == "furnace_top": d.rectangle((3, 3, 12, 12), fill="#494b4b", outline="#aaa89f"); d.rectangle((5, 5, 10, 10), fill="#252728")
    elif name.startswith("chest_"):
        d.rectangle((0, 0, 15, 15), fill=wood)
        for y in (3, 8, 13): d.line((0, y, 15, y), fill=light)
        d.rectangle((0, 0, 15, 1), fill=dark); d.rectangle((0, 7, 15, 9), fill=dark)
        if name == "chest_front": d.rectangle((6, 7, 9, 11), fill=metal, outline="#594620")
        if name == "chest_top": d.rectangle((1, 1, 14, 14), outline=dark, width=2)
    elif name.startswith("door_"):
        d.rectangle((0, 0, 15, 15), fill=wood); d.rectangle((0, 0, 15, 15), outline=dark, width=2); d.rectangle((3, 2, 12, 13), outline=light)
        if name == "door_top": d.rectangle((4, 4, 11, 11), fill=(142, 213, 224, 90), outline="#4f7680"); d.line((8, 4, 8, 11), fill="#d7eef0")
        else: d.rectangle((4, 3, 11, 11), fill="#82502b"); d.ellipse((11, 7, 13, 9), fill=metal)
    elif name == "window":
        d.rectangle((0, 0, 15, 15), fill=(150, 222, 232, 48)); d.rectangle((0, 0, 15, 15), outline=dark, width=2)
        d.line((7, 2, 7, 13), fill=light); d.line((2, 8, 13, 8), fill=light); d.line((3, 3, 5, 5), fill=(235, 255, 255, 150))
    elif name == "trapdoor":
        d.rectangle((0, 0, 15, 15), fill=dark); d.rectangle((1, 1, 14, 14), fill=wood, outline=light)
        for box in ((3, 3, 6, 6), (9, 3, 12, 6), (3, 9, 6, 12), (9, 9, 12, 12)): d.rectangle(box, fill=(0, 0, 0, 0), outline=dark)
    elif name == "ladder":
        d.rectangle((2, 0, 4, 15), fill=wood); d.rectangle((11, 0, 13, 15), fill=wood)
        for y in (2, 6, 10, 14): d.rectangle((3, y, 12, y + 1), fill=light)
    elif name.startswith("bed_"):
        d.rectangle((0, 0, 15, 15), fill="#6f3b24")
        if name == "bed_top": d.rectangle((1, 1, 14, 14), fill="#b92f3e"); d.rectangle((1, 10, 14, 14), fill="#eee2ce"); d.line((1, 9, 14, 9), fill="#7d1828")
        elif name == "bed_side": d.rectangle((0, 2, 15, 10), fill="#b92f3e"); d.rectangle((0, 10, 15, 13), fill="#eee2ce"); d.rectangle((1, 13, 3, 15), fill=dark); d.rectangle((12, 13, 14, 15), fill=dark)
        elif name == "bed_end": d.rectangle((1, 2, 14, 12), fill="#eee2ce", outline="#b92f3e", width=2)
        else: d.rectangle((1, 1, 14, 14), fill=dark)
    elif name == "torch":
        d.rectangle((0, 0, 15, 15), fill="#75461f"); d.line((2, 14, 13, 1), fill="#bd8146", width=3)
        d.rectangle((8, 1, 13, 6), fill="#f39a31"); d.rectangle((10, 1, 12, 4), fill="#ffe477")
    elif name == "lantern":
        d.rectangle((0, 0, 15, 15), fill="#30291e"); d.rectangle((1, 1, 14, 14), outline="#90713d", width=2)
        d.rectangle((4, 3, 11, 12), fill="#ffc94f", outline="#704a26"); d.rectangle((6, 4, 9, 11), fill="#fff0a0")
    elif name.startswith("lamp_"):
        on = name == "lamp_on"; d.rectangle((0, 0, 15, 15), fill="#49351f"); d.rectangle((1, 1, 14, 14), outline="#9c7541", width=2); glow = "#ffd86a" if on else "#705331"
        for box in ((4, 3, 7, 7), (9, 3, 12, 7), (4, 9, 7, 12), (9, 9, 12, 12)): d.rectangle(box, fill=glow, outline="#bb8638")
    elif name == "portal":
        d.rectangle((0, 0, 15, 15), fill="#271834")
        for i, color in enumerate(("#5a2f7d", "#8e4fba", "#c985ec")): d.rounded_rectangle((i + 1, i + 1, 14 - i, 14 - i), radius=3, outline=color)
        d.rectangle((6, 4, 8, 11), fill="#d7a6f2"); d.rectangle((4, 7, 11, 8), fill="#a964d1")
    elif name.startswith("enchanting_"):
        d.rectangle((0, 0, 15, 15), fill="#271d3d"); d.rectangle((0, 0, 15, 2), fill="#684893")
        if name == "enchanting_top": d.rectangle((2, 2, 13, 13), fill="#e8d9b0", outline="#452d64"); d.line((8, 3, 8, 12), fill="#8e4a6c"); d.line((4, 5, 7, 7), fill="#4d82a3"); d.line((9, 7, 12, 5), fill="#4d82a3")
        elif name == "enchanting_front": d.rectangle((3, 5, 12, 12), fill="#3d2c5b", outline="#58d3c8"); d.polygon(((8, 3), (11, 8), (8, 12), (5, 8)), fill="#65e0d4")
        else: d.rectangle((3, 4, 12, 12), outline="#58d3c8", width=2); d.rectangle((6, 7, 9, 10), fill="#65e0d4")
    return upscale(im)


def custom_item(name):
    im = pixel_art(); d = ImageDraw.Draw(im)
    colors = {"iron_ingot": ("#dce2df", "#858d8d"), "copper_ingot": ("#d28257", "#7f432e"), "gold_ingot": ("#f1ca45", "#9c7218"), "crystal": ("#6fe4e5", "#247e9b")}
    if name == "stick": d.line((4, 13, 12, 3), fill="#4a2c19", width=3); d.line((5, 12, 12, 4), fill="#bd8146")
    elif name in colors:
        light, dark = colors[name]
        if name == "crystal": d.polygon(((8, 1), (13, 6), (10, 14), (5, 14), (3, 7)), fill=light, outline=dark)
        else: d.polygon(((3, 6), (6, 3), (13, 3), (14, 9), (11, 12), (2, 12)), fill=light, outline=dark); d.line((5, 6, 12, 5), fill="#ffffff")
    else:
        palettes = {"spawn_sheep": ("#eee9df", "#7c756b"), "spawn_rabbit": ("#b88455", "#f0c19b"), "spawn_glow_sprite": ("#ffe66d", "#62c9c1")}; base, spots = palettes[name]
        d.ellipse((2, 1, 13, 14), fill=base, outline="#3d342e"); d.ellipse((4, 4, 7, 7), fill=spots); d.ellipse((9, 8, 12, 11), fill=spots); d.rectangle((6, 12, 8, 13), fill=spots)
    return upscale(im)


def extrude(atlas, image, x, y):
    atlas.paste(image, (x + PADDING, y + PADDING))
    atlas.paste(image.crop((0, 0, 1, CONTENT_SIZE)).resize((PADDING, CONTENT_SIZE), Image.Resampling.NEAREST), (x, y + PADDING))
    atlas.paste(image.crop((CONTENT_SIZE - 1, 0, CONTENT_SIZE, CONTENT_SIZE)).resize((PADDING, CONTENT_SIZE), Image.Resampling.NEAREST), (x + PADDING + CONTENT_SIZE, y + PADDING))
    atlas.paste(image.crop((0, 0, CONTENT_SIZE, 1)).resize((CONTENT_SIZE, PADDING), Image.Resampling.NEAREST), (x + PADDING, y))
    atlas.paste(image.crop((0, CONTENT_SIZE - 1, CONTENT_SIZE, CONTENT_SIZE)).resize((CONTENT_SIZE, PADDING), Image.Resampling.NEAREST), (x + PADDING, y + PADDING + CONTENT_SIZE))


def write_atlas(layers):
    metadata = {"version": 2, "cellSize": CONTENT_SIZE, "padding": PADDING, "layers": {}, "entries": {}}
    for layer, images in sorted(layers.items()):
        rows = (len(images) + COLUMNS - 1) // COLUMNS; width, height = COLUMNS * SOURCE_SIZE, power_of_two(rows * SOURCE_SIZE)
        atlas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        for index, (name, source) in enumerate(images):
            image = source.resize((CONTENT_SIZE, CONTENT_SIZE), Image.Resampling.LANCZOS); x, y = (index % COLUMNS) * SOURCE_SIZE, (index // COLUMNS) * SOURCE_SIZE
            extrude(atlas, image, x, y); metadata["entries"][name] = {"layer": layer, "uv": [(x + PADDING) / width, 1 - (y + PADDING + CONTENT_SIZE) / height, (x + PADDING + CONTENT_SIZE) / width, 1 - (y + PADDING) / height]}
        filename = f"blocks-{layer}.png"; atlas.save(ATLASES / filename, optimize=True); metadata["layers"][layer] = {"file": filename, "size": [width, height]}
    (ATLASES / "blocks.json").write_text(json.dumps(metadata, indent=2, sort_keys=True) + "\n")


def write_item_atlas(entries):
    rows = (len(entries) + COLUMNS - 1) // COLUMNS; width, height = COLUMNS * SOURCE_SIZE, power_of_two(rows * SOURCE_SIZE)
    atlas = Image.new("RGBA", (width, height), (0, 0, 0, 0)); metadata = {"version": 1, "cellSize": SOURCE_SIZE, "size": [width, height], "entries": {}}
    for index, (name, image) in enumerate(entries):
        x, y = (index % COLUMNS) * SOURCE_SIZE, (index // COLUMNS) * SOURCE_SIZE; atlas.paste(image, (x, y)); metadata["entries"][name] = {"x": x, "y": y, "size": SOURCE_SIZE}
    atlas.save(ATLASES / "items.png", optimize=True); (ATLASES / "items.json").write_text(json.dumps(metadata, indent=2, sort_keys=True) + "\n")


def main():
    BLOCKS.mkdir(parents=True, exist_ok=True); ITEMS.mkdir(parents=True, exist_ok=True); ATLASES.mkdir(parents=True, exist_ok=True)
    layers, manifest_entries = {}, []
    for name, (source_name, layer, operation) in sorted(TEXTURES.items()):
        image = transform(Image.open(SOURCE / source_name), operation).resize((SOURCE_SIZE, SOURCE_SIZE), Image.Resampling.NEAREST); image.save(BLOCKS / f"{name}.png", optimize=True); layers.setdefault(layer, []).append((name, image))
        manifest_entries.append({"id": name, "source": f"src/images/assets/kenney-voxel-pack/tiles/{source_name}", "output": f"src/images/game/blocks/{name}.png", "renderLayer": layer, "modification": operation or "copied"})
    for name, layer in sorted(CUSTOM_TEXTURE_LAYERS.items()):
        image = custom_block(name); image.save(BLOCKS / f"{name}.png", optimize=True); layers.setdefault(layer, []).append((name, image)); manifest_entries.append({"id": name, "source": "project-generated", "output": f"src/images/game/blocks/{name}.png", "renderLayer": layer, "modification": "original scripted pixel art"})
    write_atlas(layers)
    item_entries, item_manifest = [], []
    for name, (source_name, operation) in sorted(ITEM_TEXTURES.items()):
        image = transform(Image.open(ITEM_SOURCE / source_name), operation).resize((SOURCE_SIZE, SOURCE_SIZE), Image.Resampling.NEAREST); image.save(ITEMS / f"{name}.png", optimize=True); item_entries.append((name, image)); item_manifest.append({"id": name, "source": f"src/images/assets/kenney-voxel-pack/items/{source_name}", "output": f"src/images/game/items/{name}.png", "modification": operation or "copied"})
    for name in CUSTOM_ITEMS:
        image = custom_item(name); image.save(ITEMS / f"{name}.png", optimize=True); item_entries.append((name, image)); item_manifest.append({"id": name, "source": "project-generated", "output": f"src/images/game/items/{name}.png", "modification": "original scripted pixel art"})
    for name, source_name in sorted(FISH_ITEMS.items()):
        image = Image.open(FISH_ASSETS / source_name).convert("RGBA").resize((SOURCE_SIZE, SOURCE_SIZE), Image.Resampling.NEAREST)
        image.save(ITEMS / f"{name}.png", optimize=True); item_entries.append((name, image)); item_manifest.append({"id": name, "source": f"src/images/assets/kenney-fish-pack/{source_name}", "output": f"src/images/game/items/{name}.png", "modification": "copied and packed into shared item atlas", "license": "CC0-1.0", "author": "Kenney"})
    for path in sorted(MODEL_PREVIEWS.glob("*.png")):
        name = f"model_{path.stem}"; image = Image.open(path).convert("RGBA").resize((SOURCE_SIZE, SOURCE_SIZE), Image.Resampling.NEAREST)
        image.save(ITEMS / f"{name}.png", optimize=True); item_entries.append((name, image)); item_manifest.append({"id": name, "source": f"src/images/game/models/previews/{path.name}", "output": f"src/images/game/items/{name}.png", "modification": "rendered from project glTF cuboids"})
    model_entries = [{"id": f"model:{name}", "source": "project-generated", "output": f"src/images/game/models/{name}.gltf", "assetType": "model", "modification": "original scripted low-poly model"} for name in json.loads((GAME / "models/models.json").read_text())["models"]]
    write_item_atlas(sorted(item_entries)); (GAME / "manifest.json").write_text(json.dumps({"version": 3, "source": "https://kenney.nl/assets/voxel-pack", "license": "CC0-1.0", "entries": manifest_entries + item_manifest + model_entries}, indent=2, sort_keys=True) + "\n")
    print(f"Built {sum(map(len, layers.values()))} block textures in {len(layers)} atlases and {len(item_entries)} item icons")


if __name__ == "__main__": main()
