import {BLOCKS, BLOCK_BY_ID} from "./blocks";
import {itemArtwork} from "../images/gameAssets";

const ITEM_BLOCKS = BLOCKS.filter((block) => block.id !== "bedrock" && !block.internal);

const BLOCK_ITEMS = ITEM_BLOCKS.map((block) => ({
    id: block.id,
    name: block.name,
    maxStack: 64,
    blockId: block.id,
    atlasPreview: block.atlasPreview,
    modelPreview: block.modelPreview,
    texture: block.texture,
    uiColor: block.uiColor,
}));

const MATERIAL_ITEMS = [
    {id: "stick", name: "Stick", maxStack: 64, uiColor: "#9b6b38"},
    {id: "coal", name: "Coal", maxStack: 64, uiColor: "#202020"},
    {id: "iron_ingot", name: "Iron Ingot", maxStack: 64, uiColor: "#d8d8d0"},
    {id: "copper_ingot", name: "Copper Ingot", maxStack: 64, uiColor: "#c47a54"},
    {id: "gold_ingot", name: "Gold Ingot", maxStack: 64, uiColor: "#e0bd3f"},
    {id: "crystal", name: "Crystal", maxStack: 64, uiColor: "#72e3ea"},
    {id: "seeds", name: "Seeds", maxStack: 64, uiColor: "#77a642"},
    {id: "wheat", name: "Wheat", maxStack: 64, uiColor: "#dfbd55"},
].map((item) => ({...item, artwork: itemArtwork(item.id)}));

const CREATURE_ITEMS = [
    {id: "spawn_sheep", name: "Sheep Friend", maxStack: 64, creatureType: "sheep", uiColor: "#eee9df"},
    {id: "spawn_rabbit", name: "Rabbit Friend", maxStack: 64, creatureType: "rabbit", uiColor: "#b88455"},
    {id: "spawn_glow_sprite", name: "Glow Sprite Friend", maxStack: 64, creatureType: "glow_sprite", uiColor: "#ffe66d"},
    {id: "spawn_fish_blue", name: "Blue Reef Fish", maxStack: 64, creatureType: "fish_blue", uiColor: "#4597da"},
    {id: "spawn_fish_orange", name: "Sunset Fish", maxStack: 64, creatureType: "fish_orange", uiColor: "#f28a32"},
    {id: "spawn_fish_pink", name: "Rose Fish", maxStack: 64, creatureType: "fish_pink", uiColor: "#e76e9d"},
].map((item) => ({...item, artwork: itemArtwork(item.id)}));

const TRANSPORT_ITEMS = [
    {id: "spawn_horse", name: "Friendly Horse", maxStack: 64, vehicleType: "horse", uiColor: "#845337"},
    {id: "spawn_boat", name: "Wooden Boat", maxStack: 64, vehicleType: "boat", uiColor: "#a66b35"},
    {id: "spawn_minecart", name: "Minecart", maxStack: 64, vehicleType: "minecart", uiColor: "#8b9298"},
].map((item) => ({...item, artwork: itemArtwork(item.id)}));

const TOOL_ITEMS = [
    {id: "wooden_pickaxe", name: "Wooden Pickaxe", toolType: "pickaxe", tier: 1, speed: 2.5, maxDurability: 30, uiColor: "#a97742"},
    {id: "wooden_axe", name: "Wooden Axe", toolType: "axe", tier: 1, speed: 2.5, maxDurability: 30, uiColor: "#a97742"},
    {id: "wooden_shovel", name: "Wooden Shovel", toolType: "shovel", tier: 1, speed: 2.5, maxDurability: 30, uiColor: "#a97742"},
    {id: "stone_pickaxe", name: "Stone Pickaxe", toolType: "pickaxe", tier: 2, speed: 4, maxDurability: 65, uiColor: "#777777"},
    {id: "stone_axe", name: "Stone Axe", toolType: "axe", tier: 2, speed: 4, maxDurability: 65, uiColor: "#777777"},
    {id: "stone_shovel", name: "Stone Shovel", toolType: "shovel", tier: 2, speed: 4, maxDurability: 65, uiColor: "#777777"},
    {id: "wooden_hoe", name: "Wooden Hoe", toolType: "hoe", tier: 1, speed: 1, maxDurability: 40, uiColor: "#a97742"},
].map((item) => ({...item, maxStack: 1, artwork: itemArtwork(item.id)}));

export const ITEMS = [...BLOCK_ITEMS, ...MATERIAL_ITEMS, ...TOOL_ITEMS, ...CREATURE_ITEMS, ...TRANSPORT_ITEMS];

export const ITEM_BY_ID = Object.fromEntries(ITEMS.map((item) => [item.id, item]));

export function isItemId(value) {
    return Object.prototype.hasOwnProperty.call(ITEM_BY_ID, value);
}

const UTILITY_BLOCKS = new Set(["crafting_table", "furnace", "chest", "door", "trapdoor", "ladder", "bed", "torch", "lantern", "switch", "lamp", "farmland", "portal", "enchanting_table", "elevator"]);
const FLUID_BLOCKS = new Set(["water", "lava"]);
const NATURE_BLOCKS = new Set(["grass", "dirt", "sand", "gravel", "snow", "ice", "log", "pale_log", "leaves", "tall_grass", "flower", "cactus", "coal_ore", "iron_ore", "copper_ore", "gold_ore", "crystal_ore"]);

export const ITEM_CATEGORY_ORDER = ["blocks", "windows", "doors", "utility", "nature", "fluids", "furniture", "decor", "outdoor", "materials", "tools", "creatures", "transport"];
export const ITEM_CATEGORY_NAMES = {blocks: "Blocks", windows: "Windows", doors: "Doors", utility: "Utility", nature: "Nature", fluids: "Fluids", furniture: "Furniture", decor: "Decor", outdoor: "Outdoor", materials: "Materials", tools: "Tools", creatures: "Creatures", transport: "Transport"};

export function itemCategory(item) {
    if (item.vehicleType) return "transport";
    if (item.creatureType) return "creatures";
    if (item.toolType) return "tools";
    if (!item.blockId) return "materials";
    if (BLOCK_BY_ID[item.blockId]?.modelCategory) return BLOCK_BY_ID[item.blockId].modelCategory;
    if (item.blockId === "window") return "windows";
    if (item.blockId === "door") return "doors";
    if (UTILITY_BLOCKS.has(item.blockId)) return "utility";
    if (FLUID_BLOCKS.has(item.blockId)) return "fluids";
    if (NATURE_BLOCKS.has(item.blockId)) return "nature";
    return "blocks";
}

export function itemsInCategory(category) {
    return ITEMS.filter((item) => itemCategory(item) === category);
}

export function droppedItemForBlock(blockId) {
    if (blockId === "water" || blockId === "lava" || blockId === "bedrock") {
        return null;
    }
    if (blockId === "coal_ore") return "coal";
    if (blockId === "copper_ore") return "copper_ingot";
    if (blockId === "gold_ore") return "gold_ingot";
    if (blockId === "crystal_ore") return "crystal";
    if (blockId === "door_open") return "door";
    if (blockId === "door_top" || blockId === "door_open_top") return "door";
    if (blockId === "trapdoor_open") return "trapdoor";
    if (blockId === "lamp_on") return "lamp";
    if (blockId.startsWith("crop_")) return blockId === "crop_3" ? "wheat" : "seeds";
    return isItemId(blockId) ? blockId : null;
}
