# Phase 5 Plan: Items and Inventory

**Status:** Complete

Phase 5 turns blocks into collectible items and makes the hotbar represent real inventory state.

## 1. Item and inventory data

- Create an item registry separate from the block registry.
- Give items stack limits, display data, and an associated placeable block.
- Add pure inventory operations for adding, consuming, moving, merging, splitting, and shift-moving stacks.
- Use 36 player slots, with slots 1–9 connected to the hotbar.

## 2. Block drops

- Spawn an item entity when a survival player breaks a collectible block.
- Move nearby drops toward the player and collect them when they reach the pickup radius.
- Merge collected items into compatible stacks and leave overflow in the world.
- Despawn abandoned drops after five minutes.

## 3. Survival placement

- Place the block represented by the selected hotbar item.
- Keep the complete block catalog available as an unlimited building palette.
- Reject placement when the selected slot is empty or the item is not placeable.

## 4. Inventory interface

- Toggle the inventory with `E` and release pointer lock while it is open.
- Show the hotbar row and the remaining inventory slots.
- Support click pickup/place, right-click splitting/single placement, shift-click transfers, and drag-and-drop movement.
- Show the held cursor stack and item counts.

## 5. Creative mode

- Add a survival/creative mode control.
- Fill inventory slots from the registered item catalog without consuming placed blocks.
- Break blocks instantly in creative mode without spawning drops.
- Keep the inventory and selected hotbar slot consistent when changing modes.

## 6. Persistence and validation

- Save inventory, selected slot, game mode, and world drops.
- Migrate existing version 2 saves into the Phase 5 format.
- Test inventory operations, collection, unlimited placement, creative behavior, and save migration.

**Milestone:** Blocks produce collectible items in survival, collected stacks can be organized in an inventory, the hotbar uses real inventory slots, and creative mode provides the full item catalog for building and testing.
