# Phase 4 Implementation Plan

**Status:** Complete

Phase 4 adds fluids and a changing environment to the seeded overworld. Water and lava use procedural pixel textures, so no additional image assets are required.

## 1. Fluid block definitions

- Add water, lava, and obsidian to the block registry.
- Give fluids transparent pixel textures, reduced surface height, and fluid metadata.
- Render lava with an emissive material.
- Add water and lava to the creative hotbar for testing.

## 2. Generated water

- Define a stable sea level.
- Fill selected seeded lowland basins with water source blocks, creating local lakes without flooding every low area.
- Use sand along submerged surfaces and shorelines.
- Cull internal fluid faces while preserving boundaries against air and transparent blocks.

## 3. Swimming and underwater appearance

- Detect the fluid occupying the player's body and camera position.
- Slow horizontal movement in water.
- Reduce falling speed and allow Space to swim upward.
- Use Shift to swim downward.
- Apply blue fog and background color while underwater.

## 4. Local fluid updates

- Keep generated lakes stable.
- Keep manually placed water and lava static so one placement creates exactly one cube.
- Retain bounded downward and horizontal propagation as tested engine utilities for future opt-in fluid behavior.

## 5. Lava and reactions

- Reuse the fluid update system with shorter, slower lava flow.
- Make lava glow and act as a player hazard.
- Convert lava touching water into obsidian.

## 6. Day, night, and weather

- Move the sun through a repeating day/night cycle.
- Vary sky, fog, ambient light, and directional sunlight by time and biome.
- Add deterministic rain in plains and forests and snow in mountains.
- Keep precipitation particles around the player and disable them in deserts or clear weather periods.

## 7. Validation

- Test sea-level filling, fluid surface geometry, downward and horizontal flow, flow limits, and water/lava reactions.
- Test swimming controls and fluid detection helpers.
- Run all unit tests and the production build.
- Update the roadmap, shortcuts, README, and codebase analysis.

## Completion criteria

Phase 4 is complete when generated water renders correctly, the player can swim and see underwater fog, manually placed fluids remain single cubes, and the overworld has a functioning day/night and biome-aware weather cycle.
