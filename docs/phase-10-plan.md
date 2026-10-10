# Phase 10 Implementation Plan

**Status: Complete.** Multiplayer is intentionally excluded from this phase. The browser implementation uses a world catalog, explored-chunk map, deterministic lightweight structures, the peaceful Dream Grove dimension, and version-1 namespaced data packs for blocks and recipes.

## Goal

Turn the current single-world prototype into a long-lived single-player game with multiple managed worlds, useful navigation, deterministic structures and peaceful progression, alternate dimensions, and validated custom content. Existing saves must migrate safely, and the player and creatures must remain non-combatant and unkillable.

## Implementation order

### 1. Prepare the save and registry foundations

- Replace the single local-storage document with a world catalog and one versioned document per world ID.
- Give each world metadata: ID, name, seed, creation and last-played dates, mode, exploration setting, game rules, active dimension, and preview information.
- Preserve the current world through an automatic migration instead of silently replacing it.
- Add dimension-scoped state for chunks, generated columns, block entities, block states, scheduled updates, creatures, time, weather, and player position.
- Keep inventory, friendship progress, discoveries, and goals at world level so they can travel through portals.
- Introduce registry APIs that can distinguish built-in content from later data-pack content.

### 2. Build world creation and management

- Add a world-selection screen shown before entering gameplay.
- Support creating, naming, opening, duplicating, and deleting worlds.
- Require confirmation for deletion and keep export available before removal.
- Configure seed, survival or creative mode, and peaceful exploration settings during creation.
- Add game rules for day cycle, weather, creature spawning, crop growth, and inventory behavior.
- Export a complete world as a versioned JSON file and import it only after schema validation.
- Detect duplicate IDs during import and create a new local ID without changing the imported world data.

### 3. Add coordinates and navigation tools

- Add an **F3** debug overlay with position, facing, biome, chunk, dimension, local light, world time, and render statistics.
- Add a compass indicator that points toward the current dimension's spawn or a selected marker.
- Add an explored map based on visited chunk columns rather than revealing the whole seed immediately.
- Record biome discoveries and display them in a discovery panel.
- Let the player create, rename, recolor, select, and remove map markers.
- Persist discoveries and markers per dimension.

### 4. Generate deterministic structures

- Add a seeded structure-placement layer that runs after base terrain and before player changes are merged.
- Begin with small ruins, camps, wells, and friendly cottages; add peaceful villages after the placement rules are stable.
- Reserve structure regions so neighboring chunks generate the same structure regardless of load order.
- Validate terrain, water, slopes, and biome before placement.
- Add structure chests with deterministic loot and stable IDs so opening one cannot regenerate its contents.
- Record discovered structures on the map without exposing undiscovered locations.

### 5. Add peaceful progression

- Add rare copper, gold, crystal, and gem resources with depth and biome rules.
- Add recipes for navigation tools, portal components, decorative blocks, improved tools, and creature gifts.
- Add non-combat enchantments such as durability, mining speed, careful harvesting, light, and improved gathering.
- Add persistent goals for exploration, farming, building, crafting, friendship, structure discovery, and dimension travel.
- Show goal progress and completed milestones without adding health, hunger, attacks, hostile creatures, swords, or armor.

### 6. Add alternate dimensions and portals

- Define a dimension registry containing terrain generator, sky and fog, gravity, height limits, weather, ambient sound, and spawn rules.
- Keep the overworld as the default dimension and add one peaceful alternate realm first.
- Add a crafted portal frame and an explicit activation interaction.
- Validate a safe destination before transferring the player and create a return portal when necessary.
- Save player positions independently per dimension and restore the last safe position on return.
- Keep inventories and befriended companions consistent across transitions while preventing duplicate entities.
- Rebuild active chunks, collision, lighting, weather, and environment immediately after a dimension change.

### 7. Add validated data packs

- Define a versioned JSON schema for custom blocks, items, recipes, structures, goals, and dimensions.
- Validate IDs, references, ranges, recipes, texture formats, and structure sizes before registration.
- Namespace custom IDs to prevent collisions with built-in content and other packs.
- Add an import and management screen that lists validation errors and lets a world enable or disable compatible packs.
- Store each world's enabled pack IDs and content-version requirements.
- Preserve unknown saved IDs as visible missing-content placeholders so disabling a pack does not corrupt or erase a world.
- Apply hard limits to imported textures, structures, recipes, and generated content to keep browser rendering responsive.

### 8. Migrate, test, and document

- Add migrations from the current version-6 single-world save into the new world catalog.
- Test world isolation, export/import round trips, invalid imports, deletion, game rules, marker persistence, and dimension separation.
- Test structure determinism across chunk load orders and boundaries.
- Test portal destination safety and return travel.
- Test data-pack validation, namespaces, missing-content fallback, and save compatibility.
- Update the feature roadmap, shortcuts, save documentation, and codebase analysis after implementation.

## Delivery checkpoints

1. **Worlds:** multiple isolated worlds can be created, opened, exported, imported, and deleted safely.
2. **Navigation:** coordinates, compass direction, explored maps, discoveries, and markers persist correctly.
3. **Exploration:** deterministic structures and peaceful goals give the player reasons to travel and build.
4. **Dimensions:** portals move the player safely between independently generated and saved realms.
5. **Custom content:** validated, namespaced data packs can extend a world without making saves fragile.

## Out of scope

- Multiplayer, servers, authentication, network synchronization, permissions, reconciliation, and anti-cheat systems.
- Player or creature combat, damage, health, hunger, death, hostile behavior, weapons, or armor.

## Completion criteria

- Existing version-6 saves migrate without losing terrain, inventory, chests, creatures, crops, or block state.
- At least two separate worlds and two dimensions can be used without state leaking between them.
- Navigation reveals only explored areas and persists markers and discoveries per dimension.
- Structures remain identical for the same seed regardless of chunk load order.
- Peaceful progression covers exploration, building, farming, crafting, friendship, and dimension travel.
- Invalid or missing custom content cannot crash the game or erase saved blocks and items.

