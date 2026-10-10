import {BLOCK_BY_ID} from "./blocks";
import {ITEM_BY_ID, droppedItemForBlock} from "./items";

export function miningDuration(blockId, stack) {
    const block = BLOCK_BY_ID[blockId];
    const tool = stack ? ITEM_BY_ID[stack.itemId] : null;
    const enchantmentSpeed = 1 + (stack?.enchantments?.efficiency ?? 0) * 0.35;
    const multiplier = block?.preferredTool && tool?.toolType === block.preferredTool ? tool.speed * enchantmentSpeed : 1;
    return block ? block.hardness / multiplier : Number.POSITIVE_INFINITY;
}

export function canHarvest(blockId, stack) {
    const block = BLOCK_BY_ID[blockId];
    if (!block?.requiredTier) return true;
    const tool = stack ? ITEM_BY_ID[stack.itemId] : null;
    return tool?.toolType === block.preferredTool && tool.tier >= block.requiredTier;
}

export function miningDrop(blockId, stack) {
    return canHarvest(blockId, stack) ? droppedItemForBlock(blockId) : null;
}

export function damageTool(slots, index) {
    const stack = slots[index];
    const item = stack ? ITEM_BY_ID[stack.itemId] : null;
    if (!item?.maxDurability) return slots;
    const next = slots.slice();
    const wear = (stack.wear ?? 0) + 1;
    if (stack.enchantments?.unbreaking && wear % (stack.enchantments.unbreaking + 1) !== 0) {
        next[index] = {...stack, wear};
        return next;
    }
    const durability = (stack.durability ?? item.maxDurability) - 1;
    next[index] = durability > 0 ? {...stack, durability, wear} : null;
    return next;
}
