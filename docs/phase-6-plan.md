# Phase 6 Plan: Crafting and Tools

**Status:** Complete

Phase 6 adds data-driven crafting, tool-aware mining, durability, and persistent furnaces. The existing block catalog remains unlimited for building; crafted tools and processed materials retain their own progression rules.

## 1. Expand blocks and items

- Add crafting-table and furnace blocks with procedural textures.
- Add sticks, coal, iron ingots, and wooden and stone pickaxes, axes, and shovels.
- Store tool type, tier, speed, and maximum durability in the item registry.
- Store preferred tool and required harvest tier in block definitions.

## 2. Add recipe data

- Define shaped and shapeless recipes as plain data.
- Support normalized matching in both 2 × 2 and 3 × 3 grids.
- Add recipes for planks, sticks, crafting tables, furnaces, and wooden and stone tools.
- Consume recipe ingredients and deliver the result atomically.

## 3. Add crafting interfaces

- Add a 2 × 2 crafting grid to the player inventory.
- Open a 3 × 3 grid by right-clicking a crafting table.
- Show the matched recipe output and let the player craft it into inventory.
- Persist unfinished crafting-grid contents.

## 4. Add tool-aware mining

- Calculate breaking duration from block hardness and the selected tool.
- Make pickaxes effective on stone and ores, axes on wood, and shovels on dirt and sand.
- Require a suitable pickaxe tier for stone, coal ore, iron ore, and obsidian drops.
- Convert coal ore into coal drops when harvested correctly.

## 5. Add durability

- Damage the selected tool after a successful survival-mode block break.
- Renew a tool when its durability reaches zero so permanent inventory tools stay in their slots.
- Display remaining durability on inventory and hotbar icons.
- Keep creative-mode tools undamaged.

## 6. Add furnaces and smelting

- Store a furnace entity at each placed furnace position.
- Add input, fuel, output, burn time, and smelting progress.
- Smelt iron ore into iron ingots and sand into glass using coal, logs, or planks.
- Return furnace contents as drops when the block is broken.
- Persist and restore active furnace state.

## 7. Validate and document

- Test recipe matching and consumption, mining speed and harvest rules, durability, furnace processing, and save migration.
- Update the roadmap, shortcuts, README, and codebase analysis.

**Milestone:** The player can craft stations and tools, mine blocks with appropriate speeds and drops, wear tools down through use, and smelt resources in persistent furnaces.
