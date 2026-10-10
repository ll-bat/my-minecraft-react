import {ITEM_BY_ID, ITEMS, isItemId} from "./items";

export const HOTBAR_SIZE = 9;
export const INVENTORY_SIZE = 36;

export function emptyInventory() {
    return Array(INVENTORY_SIZE).fill(null);
}

export function creativeInventory() {
    const slots = emptyInventory();
    ITEMS.slice(0, INVENTORY_SIZE).forEach((item, index) => {
        slots[index] = {
            itemId: item.id,
            count: item.maxStack,
            ...(item.maxDurability ? {durability: item.maxDurability} : {}),
        };
    });
    return slots;
}

export function catalogInventory(value) {
    const slots = normalizeInventory(value);
    ITEMS.filter((item) => item.blockId).forEach((item) => {
        const existingIndex = slots.findIndex((stack) => stack?.itemId === item.id);
        if (existingIndex >= 0) {
            slots[existingIndex] = {...slots[existingIndex], count: item.maxStack};
            return;
        }
        const emptyIndex = slots.findIndex((stack) => stack === null);
        if (emptyIndex >= 0) {
            slots[emptyIndex] = {itemId: item.id, count: item.maxStack};
        }
    });
    return slots;
}

export function validStack(stack) {
    const valid = stack === null || Boolean(
        stack
        && isItemId(stack.itemId)
        && Number.isInteger(stack.count)
        && stack.count > 0
        && stack.count <= ITEM_BY_ID[stack.itemId].maxStack
    );
    if (!valid || stack === null) return valid;
    const item = ITEM_BY_ID[stack.itemId];
    return !item.maxDurability || (
        Number.isInteger(stack.durability)
        && stack.durability > 0
        && stack.durability <= item.maxDurability
    );
}

export function normalizeInventory(value) {
    const slots = emptyInventory();
    if (!Array.isArray(value)) return slots;
    value.slice(0, INVENTORY_SIZE).forEach((stack, index) => {
        if (stack !== null && validStack(stack)) slots[index] = {...stack};
    });
    return slots;
}

export function addItem(slots, itemId, count = 1, indexes = null) {
    if (!isItemId(itemId) || count <= 0) return {slots, remainder: count};
    const next = slots.map((stack) => stack ? {...stack} : null);
    const candidates = indexes ?? next.map((_, index) => index);
    let remainder = count;
    const maxStack = ITEM_BY_ID[itemId].maxStack;

    candidates.forEach((index) => {
        const stack = next[index];
        if (remainder > 0 && stack?.itemId === itemId && stack.count < maxStack) {
            const moved = Math.min(remainder, maxStack - stack.count);
            stack.count += moved;
            remainder -= moved;
        }
    });
    candidates.forEach((index) => {
        if (remainder > 0 && !next[index]) {
            const moved = Math.min(remainder, maxStack);
            next[index] = {
                itemId,
                count: moved,
                ...(ITEM_BY_ID[itemId].maxDurability ? {durability: ITEM_BY_ID[itemId].maxDurability} : {}),
            };
            remainder -= moved;
        }
    });
    return {slots: next, remainder};
}

export function addStack(slots, stack) {
    const item = stack ? ITEM_BY_ID[stack.itemId] : null;
    if (!item) return {slots, remainder: stack?.count ?? 0};
    if (!item.maxDurability) return addItem(slots, stack.itemId, stack.count);
    const index = slots.findIndex((slot) => slot === null);
    if (index < 0) return {slots, remainder: stack.count};
    const next = slots.slice();
    next[index] = {...stack};
    return {slots: next, remainder: 0};
}

export function consumeItem(slots, index, count = 1) {
    const stack = slots[index];
    if (!stack || count <= 0 || stack.count < count) return null;
    const next = slots.slice();
    next[index] = stack.count === count ? null : {...stack, count: stack.count - count};
    return next;
}

export function transferStack(slots, from, to, amount = Number.POSITIVE_INFINITY) {
    if (from === to || !slots[from] || !Number.isInteger(to) || to < 0 || to >= slots.length) return slots;
    const next = slots.map((stack) => stack ? {...stack} : null);
    const source = next[from];
    const destination = next[to];
    const limit = ITEM_BY_ID[source.itemId].maxStack;

    if (!destination) {
        const moved = Math.min(source.count, amount, limit);
        next[to] = {itemId: source.itemId, count: moved};
        source.count -= moved;
    } else if (destination.itemId === source.itemId) {
        const moved = Math.min(source.count, amount, limit - destination.count);
        destination.count += moved;
        source.count -= moved;
    } else if (amount >= source.count) {
        next[from] = destination;
        next[to] = source;
        return next;
    }

    if (source.count === 0) next[from] = null;
    return next;
}

export function shiftMove(slots, index) {
    if (!slots[index]) return slots;
    const targets = index < HOTBAR_SIZE
        ? Array.from({length: INVENTORY_SIZE - HOTBAR_SIZE}, (_, offset) => offset + HOTBAR_SIZE)
        : Array.from({length: HOTBAR_SIZE}, (_, target) => target);
    let next = slots;
    for (const target of targets) {
        if (!next[index]) break;
        next = transferStack(next, index, target);
    }
    return next;
}

export function interactSlot(slots, index, held, rightClick = false) {
    const slot = slots[index];
    const next = slots.map((stack) => stack ? {...stack} : null);
    let nextHeld = held ? {...held} : null;

    if (!nextHeld && slot) {
        const taken = rightClick ? Math.ceil(slot.count / 2) : slot.count;
        nextHeld = {itemId: slot.itemId, count: taken};
        const remaining = slot.count - taken;
        next[index] = remaining ? {itemId: slot.itemId, count: remaining} : null;
    } else if (nextHeld && !slot) {
        const placed = rightClick ? 1 : nextHeld.count;
        next[index] = {itemId: nextHeld.itemId, count: placed};
        nextHeld.count -= placed;
    } else if (nextHeld && slot?.itemId === nextHeld.itemId) {
        const capacity = ITEM_BY_ID[nextHeld.itemId].maxStack - slot.count;
        const placed = Math.min(capacity, rightClick ? 1 : nextHeld.count);
        next[index].count += placed;
        nextHeld.count -= placed;
    } else if (nextHeld && slot && !rightClick) {
        next[index] = nextHeld;
        nextHeld = {...slot};
    }

    if (nextHeld?.count === 0) nextHeld = null;
    return {slots: next, held: nextHeld};
}
