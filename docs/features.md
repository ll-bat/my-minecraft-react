# Feature Roadmap

This roadmap orders features by dependency and implementation risk. Each phase should leave the game playable before the next phase begins. The early phases stabilize the current prototype; later phases build Minecraft-style exploration, crafting, survival, and world simulation on top of that foundation.

## Phase 1: Stabilize the current block-building loop

**Status: Complete.** The block registry, grid rules, breaking and placement controls, hotbar, persistence controls, cleanup, and focused tests are implemented.

These items should be completed before adding new world systems.

1. **Fix block placement on every face**
   - Correct the negative-Y face mapping in `Cube`.
   - Represent the six face directions as named coordinate offsets instead of a long conditional chain.
   - Place every user-created block on an integer grid.

2. **Make cube removal a standard action**
   - Use a held right-click for block breaking.
   - Use left-click for block placement and disable the browser context menu over the game.
   - Add a short breaking delay so blocks are not removed accidentally.
   - Show a simple cracking/progress indicator while a block is being broken.

3. **Prevent invalid placement**
   - Do not create a block if its target coordinate is occupied.
   - Do not place a block inside the player collider.
   - Limit interaction to a short reach distance from the player.

4. **Finish block selection**
   - Keep number keys 1–9 as shortcuts.
   - Replace the temporary centered selector with a persistent hotbar at the bottom of the screen.
   - Highlight the selected slot and allow mouse-wheel selection.
   - Keep block definitions—ID, name, texture, and properties—in one registry.

5. **Repair save and reset controls**
   - Pass callback functions correctly to the menu buttons.
   - Load saved blocks from `localStorage` when the store initializes.
   - Make reset clear both live state and saved state.
   - Add a confirmation step before deleting a saved world.

6. **Clean up the prototype code**
   - Remove disabled animation code, unused helpers, debug logging, and unused Create React App styles.
   - Configure textures once instead of mutating them during component renders.
   - Resolve the current build warnings.

**Milestone:** The player can reliably move, select blocks, place them, break them, save the result, reload it, and reset the world.

## Phase 2: Build a scalable world foundation

**Status: Core foundation implemented during Phase 3.** Chunk storage, visible-face meshes, active loading, chunk collision bodies, boundary rebuilds, and versioned saves are complete. Moving large saves from `localStorage` to IndexedDB remains outstanding.

World architecture should be improved before terrain, water, or large maps are added.

1. **Introduce a block registry**
   - Give every block type a stable ID.
   - Store properties such as display name, texture faces, solidity, transparency, hardness, tool requirement, light behavior, and dropped item.
   - Start with air, grass, dirt, stone, sand, wood, leaves, glass, and water.

2. **Use coordinate-based world storage**
   - Store blocks by integer coordinates, such as `x,y,z`, for fast occupancy checks.
   - Separate persistent world data from temporary rendered objects.
   - Ensure that adding, updating, and removing a block changes only the affected location.

3. **Divide the world into chunks**
   - Group blocks into fixed-size chunks, for example 16 × 16 columns.
   - Load and render chunks close to the player.
   - Unload distant chunks while retaining their saved data.
   - Track dirty chunks that need to be rebuilt or saved.

4. **Optimize block rendering**
   - Render only faces exposed to air or transparent blocks.
   - Combine visible faces into chunk meshes or use instancing as an intermediate step.
   - Rebuild only the changed chunk and an adjacent chunk when a boundary block changes.
   - Avoid one React component and one physics body per block.

5. **Replace per-block physics**
   - Generate collision shapes from nearby solid blocks or chunk surfaces.
   - Keep the player as a dynamic collider while treating the voxel world as static collision data.
   - Add reliable ground/contact detection for jumping.

6. **Create versioned world saves**
   - Save the seed, player state, changed chunks, inventory, and world version.
   - Use IndexedDB when world data becomes too large for `localStorage`.
   - Add migrations so future releases can open older worlds.

**Milestone:** The game can support a growing voxel world without creating a mesh and physics body for every block.

## Phase 3: Generate an explorable overworld

**Status: Complete.** Seeded terrain, layers, caves, ore veins, trees, vegetation, four biomes, terraced forest and mountain highlands capped at height 50, environment changes, world bounds, safe spawning, and fall recovery are implemented.

1. **Add seeded terrain generation**
   - Let the player create a world from a numeric or text seed.
   - Use coherent noise to generate hills and valleys.
   - Produce the same terrain whenever the same seed is used.

2. **Generate material layers**
   - Place grass on the surface, dirt below it, and stone deeper underground.
   - Use sand near water level.
   - Add bedrock or another lower world boundary.

3. **Add caves and ore distribution**
   - Carve caves with 3D noise or connected tunnel generation.
   - Distribute coal, iron, and later ores by depth and rarity.
   - Generate ore veins rather than isolated random blocks.

4. **Add trees and vegetation**
   - Generate trunks and leaf canopies after terrain generation.
   - Add grass, flowers, and simple plants as non-solid blocks.
   - Prevent structures from crossing unloaded chunk boundaries incorrectly.

5. **Add biomes**
   - Derive temperature and moisture maps from the world seed.
   - Begin with plains, forest, desert, and mountains.
   - Vary surface blocks, vegetation, terrain height, and sky/fog appearance by biome.

6. **Add world boundaries and player recovery**
   - Define minimum and maximum build heights.
   - Respawn the player after falling below the world.
   - Find a safe spawn point on generated terrain.

**Milestone:** A seed creates a repeatable, chunked overworld with terrain, caves, resources, vegetation, and several biomes.

## Phase 4: Add water and environmental simulation

**Status: Complete.** Finite river generation, swimming, underwater fog, static player-placed fluid cubes, bounded fluid engine utilities, lava hazards, day/night lighting, rain, and snow are implemented. Rivers are the only automatically generated water.

Water depends on chunking, transparent block rendering, and block property support.

1. **Render still water**
   - Add a transparent, tinted water material with a slightly lowered top surface.
   - Render water faces only where they touch air or a different transparent block.
   - Add underwater fog and color changes when the camera is submerged.
   - Carve deterministic finite rivers with moderate widths, sand beds, tapered endpoints, paths longer than the maximum view diameter, and water levels that stay flat or descend downstream.

2. **Add player interaction with water**
   - Slow walking movement while submerged.
   - Add swimming upward and downward.
   - Reduce gravity and falling speed in water.
   - Track whether the player's head is above or below the surface.

3. **Keep placed water predictable**
   - Treat each player placement as one static water cube.
   - Do not enqueue placed water when neighboring blocks change.
   - Keep bounded flow logic available for a future optional simulation mode.

4. **Add lava after water is stable**
   - Reuse the fluid material system with slower movement and emitted light, without player damage.
   - Define water/lava reactions such as stone or obsidian creation.

5. **Add a day/night cycle and weather**
   - Move the sun and vary sky and ambient-light intensity over time.
   - Add rain and snow after biome and water behavior are established.
   - Keep weather effects local to visible chunks.

**Milestone:** Finite rivers render correctly, the player can swim, placed fluids remain predictable, and the environment changes over time.

## Phase 5: Add items and inventory

**Status: Complete.** The item registry, collectible drops, stack-based inventory, nine-slot hotbar, inventory interface, unlimited building catalog, held creative breaking, and versioned persistence are implemented. Creative flight remains an optional future movement feature.

1. **Create an item registry**
   - Distinguish placed blocks from inventory items.
   - Define stack size, icon, use behavior, and associated block or tool.

2. **Turn broken blocks into drops**
   - Spawn a collectible item entity instead of deleting a block without reward.
   - Pull nearby drops toward the player and add them to inventory on contact.
   - Despawn abandoned drops after a time limit.

3. **Add inventory stacks**
   - Implement stack merging, splitting, moving, and maximum sizes.
   - Connect the first inventory row to the hotbar.
   - Keep the registered block catalog available for unlimited placement.

4. **Build an inventory interface**
   - Open and close it with a keyboard shortcut.
   - Release pointer lock while the interface is open.
   - Support click, shift-click, and drag interactions incrementally.

5. **Add creative mode**
   - Provide all registered blocks and items without stack limits.
   - Allow fast held breaking and optional flight.
   - Use creative mode as a practical tool for testing later features.

**Milestone:** Blocks produce items, items can be collected and organized, and the hotbar represents real inventory state.

## Phase 6: Add crafting and tools

**Status: Complete.** Data-driven 2 × 2 and 3 × 3 crafting, crafting tables, wooden and stone tools, tool-specific mining speeds, harvest tiers, durability, persistent furnaces, fuels, and smelting are implemented.

1. **Add recipe data and 2 × 2 crafting**
   - Define shaped and shapeless recipes as data.
   - Add the player crafting grid to the inventory screen.
   - Consume ingredients and create the result atomically.

2. **Add a crafting table**
   - Make it a placeable interactive block.
   - Open a 3 × 3 crafting interface when used.
   - Add initial recipes for planks, sticks, crafting tables, and tools.

3. **Add tool types and block hardness**
   - Introduce pickaxes, axes, and shovels.
   - Calculate breaking time from block hardness and the selected tool.
   - Restrict valuable drops when the wrong tool or tier is used.

4. **Add tool durability**
   - Reduce durability when a tool is used successfully.
   - Break the item when durability reaches zero.
   - Display durability on the hotbar icon.

5. **Add furnaces and smelting**
   - Implement a block entity with input, fuel, output, and progress state.
   - Save active furnace state with its chunk.
   - Add recipes such as ore to ingot and sand to glass.

**Milestone:** The player can gather resources, craft tools, mine more effectively, and process materials.

## Phase 8: Add friendly creatures and companionship

**Status: Complete.** Persistent sheep, rabbits, and nighttime glow sprites spawn by terrain rules, wander peacefully, avoid hazards, accept petting, show heart feedback, give cooldown-limited gifts, and calmly follow friends. Player and creature damage paths are intentionally absent.

1. **Create an entity framework**
   - Give entities position, velocity, health, animation state, and update behavior.
   - Update only entities near active players.
   - Save persistent entities with their chunk.

2. **Add peaceful creatures**
   - Start with simple animals that wander, avoid obstacles, and offer occasional gifts.
   - Add spawning rules based on biome, terrain, light, and distance from the player.

3. **Add friendly nocturnal creatures**
   - Spawn gentle glowing creatures in low light and at night.
   - Let them notice and calmly follow nearby players without attacks or collision damage.
   - Despawn temporary wild creatures far from active players while preserving befriended companions.

4. **Add friendly player interaction**
   - Let the player pet or befriend a creature within interaction reach.
   - Add an interaction cooldown and clear heart feedback.
   - Do not add attacks, creature damage, player health, death, swords, or armor.

5. **Add friendship gifts and peaceful progression**
   - Let befriended creatures occasionally give flowers or simple materials.
   - Balance spawn rates and gifts around biome and day/night conditions.

**Milestone:** The world contains peaceful day and night creatures that wander, follow, and interact as friends. The player and creatures cannot be harmed or killed.

## Phase 9: Add richer world interactions

**Status: Complete.** Persistent revision-checked chests, framed transparent windows, coordinated two-block-high doors, oriented utility blocks, opening trapdoors, climbable ladders, night-skipping beds, cross-chunk emitted light and skylight queries, switches and lamps, scheduled hydrated crop growth, harvesting, friendship uses for wheat, synthesized sound, action particles, furnace smoke, and held-item animation are implemented. The peaceful rules remain intact: there is no player damage, health, or death system.

1. **Interactive storage blocks**
   - Add chests with persistent inventories.
   - Prevent two interfaces from editing the same inventory inconsistently.

2. **Doors, trapdoors, ladders, and beds**
   - Support blocks with orientation and changing states.
   - Let beds provide resting interaction and advance the night when conditions allow.

3. **Lighting system**
   - Calculate skylight and block-emitted light per voxel.
   - Propagate lighting changes across chunk boundaries.
   - Use light levels for rendering and creature spawning.

4. **Block updates and simple circuits**
   - Add scheduled updates for crops and other changing blocks.
   - Introduce switches, powered states, and simple signal propagation only after the update system is reliable.

5. **Farming**
   - Add tillable soil, seeds, growth stages, water proximity, and harvesting.
   - Connect crops to crafting and peaceful friendship progression without health or hunger mechanics.

6. **Sound, particles, and animation polish**
   - Add footsteps based on the block below the player.
   - Add placement, breaking, water, creature, and ambient sounds.
   - Add particles for breaking blocks, hits, smoke, and weather.
   - Animate the held item and player actions.

**Milestone:** The world feels responsive and supports persistent structures, useful blocks, lighting, farming, and audiovisual feedback.

## Phase 10: Add advanced systems

These features should come after the single-player world and save model are stable.

**Status: Complete.** Multiplayer is excluded from the current project scope. Multiple isolated worlds, export/import, exploration tools, deterministic structures, rare resources, peaceful goals and enchantments, Dream Grove portal travel, and validated namespaced data packs are implemented. Seeded Overworld structures now include sparse furnished houses, four-floor hotels with dry sunken courtyards, five-floor residential buildings, and fenced stadiums with biome-aware styles. The ordered implementation is documented in `docs/phase-10-plan.md`.

1. **World creation and management UI**
   - Create, name, list, open, export, import, and delete multiple worlds.
   - Configure seed, mode, peaceful exploration settings, and game rules per world.

2. **Map and navigation features**
   - Add coordinates and a debug overlay first.
   - Later add compasses, maps, markers, and biome discovery.

3. **Structures and progression**
   - Generate villages, ruins, puzzle vaults, and other seeded structures without hostile encounters.
   - Place biome-aware houses only on suitable dry terrain, keep them well spaced, and furnish them with functional doors, windows, lights, and decorative objects.
   - Add rarer multi-floor hotels with sunken courtyards and tall residential buildings while keeping each generated landmark safe for column-based streaming.
   - Add standard and grand regional stadiums with seeded size selection, visible fenced enclosures, full marked pitches, tiered stands, wide entrances, goals, benches, scoreboards, and tall floodlights.
   - Add rarer materials, enchantments, and progression goals only when their supporting systems exist.

4. **Dimensions or alternate worlds**
   - Generalize world generation and storage so each dimension has its own rules and chunks.
   - Add portals and cross-dimension player state.

5. **Modding and custom content**
   - Load blocks, items, recipes, and assets from validated data packs.
   - Version the content format and protect saved worlds from missing definitions.

**Milestone:** The project supports multiple long-lived worlds, exploration and peaceful progression, alternate dimensions, and validated custom content.

## Recommended immediate development sequence

The first implementation cycle should stay intentionally small:

1. Fix face-based placement and add occupancy checks.
2. Use left-click placement and held right-click breaking with reach limits.
3. Build the persistent hotbar and central block registry.
4. Repair save, load, and reset behavior.
5. Replace the current generated cubes with integer-grid world data.
6. Introduce chunks and optimize rendering before generating larger terrain.
7. Add seeded terrain with grass, dirt, stone, sand, trees, and caves.
8. Add still water, swimming, and then local water flow.
9. Add collectible drops, a persistent inventory and hotbar, and creative mode.

Completing this sequence creates the foundation needed for inventory, crafting, survival, creatures, and the later systems without repeatedly replacing the underlying world representation.
