# Phase 3 Implementation Plan

**Status:** Complete

Phase 3 creates an explorable, deterministic overworld. Because Phase 2 has not yet been implemented, this work also includes the chunk storage, rendering, collision, and versioned-save pieces required to make generated terrain practical.

## 1. World and chunk model

- Divide the world into 16 × 16 × 16 chunks.
- Convert correctly between world, chunk, and local coordinates, including negative positions.
- Store blocks by chunk and local voxel index for constant-time lookup.
- Track generated columns and update only the chunk affected by a block change.

## 2. Deterministic generation

- Convert numeric or text seeds into stable integer seeds.
- Implement deterministic 2D and 3D value noise without adding a runtime dependency.
- Generate the same terrain, biome, caves, ores, and vegetation for the same seed.

## 3. Terrain and biomes

- Generate plains, forests, deserts, and mountains from temperature, moisture, and elevation noise.
- Build grass, dirt, stone, sand, and bedrock layers.
- Enforce minimum and maximum world heights.
- Find a safe initial spawn position on the terrain surface.

## 4. Caves, ores, and vegetation

- Carve connected underground caves with 3D noise.
- Generate coal and iron in clustered veins with depth rules.
- Add deterministic trees that cross chunk borders correctly.
- Add non-solid grass and flowers in suitable biomes.

## 5. Chunk rendering and collision

- Generate geometry only for faces exposed to air or non-solid plants.
- Group rendered faces by block material.
- Render nearby chunk columns and unload distant meshes.
- Replace per-block physics bodies with one static collision mesh per rendered chunk.
- Dispose replaced geometry when a chunk changes or unloads.

## 6. Interaction migration

- Raycast chunk faces back to voxel coordinates.
- Preserve left-click placement, held right-click breaking, reach limits, hardness, occupancy checks, and player-collision checks.
- Rebuild the changed chunk and boundary neighbor when required.

## 7. Worlds, saving, and recovery

- Add a seed field and confirmed new-world action.
- Save a versioned world document containing the seed, modified/generated chunks, selection, and player position.
- Migrate the existing flat cube-array save when possible.
- Respawn the player at a safe surface position after falling below the world.

## 8. Validation

- Test seed stability, negative chunk coordinates, layer rules, caves, ores, biome selection, and save parsing.
- Test block changes across chunk boundaries.
- Run the full unit suite and production build.
- Update the roadmap and architecture documentation after completion.

## Completion criteria

Phase 3 is complete when a seed creates a repeatable chunked overworld with terrain layers, four biomes, caves, ore veins, trees, vegetation, safe spawning, and fall recovery, while existing placement, breaking, selection, save, load, and reset behavior continue to work.
