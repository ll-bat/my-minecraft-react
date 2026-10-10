import {
    dirtImg,
    glassImg,
    grassImg,
    logImg,
    woodImg
} from "../images/images";
import {
    dirtTexture,
    glassTexture,
    grassTexture,
    logTexture,
    woodTexture
} from "../images/textures";
import {createBlockTexture, createDoorTexture, createFramedWindowTexture, createPlantTexture} from "./proceduralTextures";

export const BLOCKS = [
    {id: "dirt", name: "Dirt", image: dirtImg, texture: dirtTexture, hardness: 350, preferredTool: "shovel", solid: true, placeable: true},
    {id: "grass", name: "Grass", image: grassImg, texture: grassTexture, hardness: 400, preferredTool: "shovel", solid: true, placeable: true},
    {id: "glass", name: "Glass", image: glassImg, texture: glassTexture, hardness: 250, solid: true, transparent: true, placeable: true},
    {id: "window", name: "Framed Window", texture: createFramedWindowTexture(), uiColor: "#87b9bd", hardness: 350, preferredTool: "axe", solid: true, transparent: true},
    {id: "log", name: "Log", image: logImg, texture: logTexture, hardness: 650, preferredTool: "axe", solid: true, placeable: true},
    {id: "wood", name: "Wood Planks", image: woodImg, texture: woodTexture, hardness: 550, preferredTool: "axe", solid: true, placeable: true},
    {id: "water", name: "Water", texture: createBlockTexture("#267bc7", "#4da6df", 0.3), hardness: 180, solid: false, transparent: true, shape: "fluid", fluid: true, flowDistance: 6, flowDelay: 1, placeable: true, uiColor: "#298bd3"},
    {id: "lava", name: "Lava", texture: createBlockTexture("#e85b16", "#ffc52b", 0.32), hardness: 220, solid: false, transparent: true, shape: "fluid", fluid: true, flowDistance: 3, flowDelay: 4, placeable: true, uiColor: "#ee661a", emissive: "#ff4b0a"},
    {id: "stone", name: "Stone", texture: createBlockTexture("#777777", "#929292"), hardness: 900, preferredTool: "pickaxe", requiredTier: 1, solid: true},
    {id: "sand", name: "Sand", texture: createBlockTexture("#d8c57b", "#b8a55f"), hardness: 300, preferredTool: "shovel", solid: true},
    {id: "bedrock", name: "Bedrock", texture: createBlockTexture("#292929", "#4a4a4a", 0.35), hardness: Number.POSITIVE_INFINITY, solid: true},
    {id: "coal_ore", name: "Coal Ore", texture: createBlockTexture("#777777", "#202020", 0.28), hardness: 1100, preferredTool: "pickaxe", requiredTier: 1, solid: true},
    {id: "iron_ore", name: "Iron Ore", texture: createBlockTexture("#777777", "#b7805f", 0.25), hardness: 1250, preferredTool: "pickaxe", requiredTier: 2, solid: true},
    {id: "copper_ore", name: "Copper Ore", texture: createBlockTexture("#777777", "#bd7048", 0.24), hardness: 1200, preferredTool: "pickaxe", requiredTier: 1, solid: true},
    {id: "gold_ore", name: "Gold Ore", texture: createBlockTexture("#777777", "#e0bd3f", 0.22), hardness: 1450, preferredTool: "pickaxe", requiredTier: 2, solid: true},
    {id: "crystal_ore", name: "Crystal Ore", texture: createBlockTexture("#5c6178", "#72e3ea", 0.2), hardness: 1650, preferredTool: "pickaxe", requiredTier: 2, solid: true, light: 6, emissive: "#3dcbd8"},
    {id: "crystal_block", name: "Crystal Block", texture: createBlockTexture("#477b89", "#a1f6ee", 0.18), hardness: 1000, preferredTool: "pickaxe", solid: true, light: 10, emissive: "#50dcd1"},
    {id: "obsidian", name: "Obsidian", texture: createBlockTexture("#241638", "#4b2869", 0.25), hardness: 2500, preferredTool: "pickaxe", requiredTier: 3, solid: true},
    {id: "leaves", name: "Leaves", texture: createBlockTexture("#3f7d32", "#245c28", 0.35), hardness: 180, solid: true, transparent: true},
    {id: "tall_grass", name: "Tall Grass", texture: createPlantTexture("#4d963f"), hardness: 100, solid: false, transparent: true, shape: "cross"},
    {id: "flower", name: "Flower", texture: createPlantTexture("#3e8a38", "#e6cf4a"), hardness: 100, solid: false, transparent: true, shape: "cross"},
    {id: "crafting_table", name: "Crafting Table", texture: createBlockTexture("#8b5a2b", "#d29a55", 0.3), uiColor: "#9b6635", hardness: 700, preferredTool: "axe", solid: true},
    {id: "furnace", name: "Furnace", texture: createBlockTexture("#666666", "#303030", 0.3), uiColor: "#5f5f5f", hardness: 1100, preferredTool: "pickaxe", requiredTier: 1, solid: true},
    {id: "chest", name: "Chest", texture: createBlockTexture("#a66a2c", "#4b2c14", 0.2), uiColor: "#a66a2c", hardness: 600, preferredTool: "axe", solid: true, oriented: true},
    {id: "door", name: "Wooden Door", texture: createDoorTexture("bottom"), uiColor: "#a86f38", hardness: 500, preferredTool: "axe", solid: true, oriented: true, shape: "door", doorPart: "bottom"},
    {id: "door_top", name: "Wooden Door Top", texture: createDoorTexture("top"), uiColor: "#a86f38", hardness: 500, preferredTool: "axe", solid: true, oriented: true, shape: "door", doorPart: "top", internal: true},
    {id: "door_open", name: "Open Door", texture: createDoorTexture("bottom"), uiColor: "#a86f38", hardness: 500, preferredTool: "axe", solid: true, shape: "door", doorPart: "bottom", internal: true},
    {id: "door_open_top", name: "Open Door Top", texture: createDoorTexture("top"), uiColor: "#a86f38", hardness: 500, preferredTool: "axe", solid: true, shape: "door", doorPart: "top", internal: true},
    {id: "trapdoor", name: "Trapdoor", texture: createBlockTexture("#82532b", "#bd8249", 0.25), uiColor: "#82532b", hardness: 450, preferredTool: "axe", solid: true, oriented: true, shape: "trapdoor"},
    {id: "trapdoor_open", name: "Open Trapdoor", texture: createBlockTexture("#82532b", "#bd8249", 0.25), uiColor: "#82532b", hardness: 450, preferredTool: "axe", solid: true, transparent: true, shape: "trapdoor", internal: true},
    {id: "ladder", name: "Ladder", texture: createPlantTexture("#9d713d", "#d5aa6c"), uiColor: "#a77943", hardness: 250, preferredTool: "axe", solid: false, transparent: true, shape: "ladder", oriented: true},
    {id: "bed", name: "Bed", texture: createBlockTexture("#b83939", "#f1ded2", 0.18), uiColor: "#c64141", hardness: 350, solid: true, oriented: true, shape: "bed"},
    {id: "torch", name: "Torch", texture: createPlantTexture("#8c5b28", "#ffe36b"), uiColor: "#f4c84d", hardness: 80, solid: false, transparent: true, shape: "cross", light: 14},
    {id: "switch", name: "Switch", texture: createPlantTexture("#777777", "#d1b58a"), uiColor: "#80766a", hardness: 180, solid: false, transparent: true, shape: "cross", oriented: true},
    {id: "lamp", name: "Redstone Lamp", texture: createBlockTexture("#674b28", "#9b7641", 0.28), uiColor: "#73552f", hardness: 650, preferredTool: "pickaxe", solid: true},
    {id: "lamp_on", name: "Powered Lamp", texture: createBlockTexture("#c78a35", "#ffe18b", 0.15), uiColor: "#e9a948", hardness: 650, preferredTool: "pickaxe", solid: true, light: 15, emissive: "#ffb329", internal: true},
    {id: "farmland", name: "Farmland", texture: createBlockTexture("#65421f", "#9b6936", 0.24), uiColor: "#72502c", hardness: 300, preferredTool: "shovel", solid: true, shape: "farmland"},
    {id: "crop_0", name: "Seedling", texture: createPlantTexture("#4e8c33", "#76bb45"), hardness: 80, solid: false, transparent: true, shape: "cross", internal: true, cropStage: 0},
    {id: "crop_1", name: "Young Crop", texture: createPlantTexture("#599233", "#a1c84c"), hardness: 80, solid: false, transparent: true, shape: "cross", internal: true, cropStage: 1},
    {id: "crop_2", name: "Growing Crop", texture: createPlantTexture("#71943a", "#d5c854"), hardness: 80, solid: false, transparent: true, shape: "cross", internal: true, cropStage: 2},
    {id: "crop_3", name: "Mature Crop", texture: createPlantTexture("#8b8435", "#ead06b"), hardness: 80, solid: false, transparent: true, shape: "cross", internal: true, cropStage: 3},
    {id: "portal", name: "Dream Portal", texture: createBlockTexture("#513b70", "#b982df", 0.18), uiColor: "#9b66c2", hardness: 1200, preferredTool: "pickaxe", solid: true, light: 12, emissive: "#a260d0"},
    {id: "enchanting_table", name: "Enchanting Table", texture: createBlockTexture("#30234a", "#72d9d0", 0.2), uiColor: "#59417e", hardness: 1300, preferredTool: "pickaxe", requiredTier: 2, solid: true, light: 5, emissive: "#49bdb5"},
];

export const PLACEABLE_BLOCKS = BLOCKS.filter((block) => block.placeable);

export const BLOCK_BY_ID = Object.fromEntries(
    BLOCKS.map((block) => [block.id, block])
);

export const DEFAULT_BLOCK_ID = PLACEABLE_BLOCKS[0].id;

export function isBlockId(value) {
    return Object.prototype.hasOwnProperty.call(BLOCK_BY_ID, value);
}
