import {BLOCKS, BLOCK_BY_ID} from "./blocks";
import {ITEMS, ITEM_BY_ID} from "./items";
import {CRAFTING_RECIPES} from "./crafting";
import {createBlockTexture} from "./proceduralTextures";

export const DATA_PACKS_KEY = "minecraft-react-data-packs";
const ID = /^[a-z][a-z0-9_]{1,23}$/;

export function validateDataPack(value) {
    const errors = [];
    if (!value || value.version !== 1) errors.push("Pack version must be 1");
    if (!ID.test(value?.namespace ?? "")) errors.push("Namespace must use lowercase letters, numbers, and underscores");
    if (!Array.isArray(value?.blocks) || value.blocks.length > 32) errors.push("Blocks must be an array with at most 32 entries");
    (value?.blocks ?? []).forEach((block, index) => {
        if (!ID.test(block?.id ?? "")) errors.push(`Block ${index + 1} has an invalid ID`);
        if (typeof block?.name !== "string" || !block.name.trim()) errors.push(`Block ${index + 1} needs a name`);
        if (!/^#[0-9a-f]{6}$/i.test(block?.color ?? "")) errors.push(`Block ${index + 1} needs a six-digit hex color`);
    });
    if (value?.recipes !== undefined && (!Array.isArray(value.recipes) || value.recipes.length > 64)) errors.push("Recipes must be an array with at most 64 entries");
    return {ok: errors.length === 0, errors};
}

export function registerDataPack(pack) {
    const validation = validateDataPack(pack);
    if (!validation.ok) return validation;
    pack.blocks.forEach((source) => {
        const id = `${pack.namespace}:${source.id}`;
        if (BLOCK_BY_ID[id]) return;
        const block = {id, name: source.name.trim(), texture: createBlockTexture(source.color, source.accent ?? "#ffffff", 0.22), uiColor: source.color, hardness: Math.max(50, Math.min(3000, Number(source.hardness) || 400)), solid: source.solid !== false, transparent: source.solid === false, placeable: true, custom: true};
        const item = {id, name: block.name, maxStack: 64, blockId: id, texture: block.texture, uiColor: block.uiColor};
        BLOCKS.push(block); BLOCK_BY_ID[id] = block; ITEMS.push(item); ITEM_BY_ID[id] = item;
    });
    (pack.recipes ?? []).forEach((recipe, index) => {
        const resultId = recipe.result?.includes(":") ? recipe.result : `${pack.namespace}:${recipe.result}`;
        if (!Array.isArray(recipe.ingredients) || !ITEM_BY_ID[resultId]) return;
        const ingredients = recipe.ingredients.map((id) => id.includes(":") ? id : `${pack.namespace}:${id}`);
        if (ingredients.every((id) => ITEM_BY_ID[id])) CRAFTING_RECIPES.push({id: `${pack.namespace}:recipe_${index}`, type: "shapeless", ingredients, result: {itemId: resultId, count: Math.max(1, Math.min(64, recipe.count || 1))}});
    });
    return {ok: true, errors: []};
}

export function savedDataPacks() {
    if (typeof window === "undefined") return [];
    try { const value = JSON.parse(window.localStorage.getItem(DATA_PACKS_KEY) ?? "[]"); return Array.isArray(value) ? value : []; } catch { return []; }
}

export function registerSavedPacks() {
    return savedDataPacks().filter((pack) => registerDataPack(pack).ok);
}

export function saveDataPack(pack) {
    const packs = savedDataPacks().filter((value) => value.namespace !== pack.namespace);
    packs.push(pack);
    window.localStorage.setItem(DATA_PACKS_KEY, JSON.stringify(packs));
    return packs;
}
