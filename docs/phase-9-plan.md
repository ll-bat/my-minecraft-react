# Phase 9 Implementation Plan

**Status: Complete.**

## Goal

Make the overworld react to the player through persistent storage and utility blocks, useful lighting and simple power, farming, and clear audiovisual feedback. All interactions remain peaceful: the player has no health, and there are no damage, attack, or death mechanics.

## Implementation order

1. **Extend the block and item registries**
   - Add chests, doors, trapdoors, ladders, beds, torches, switches, lamps, farmland, crops, seeds, wheat, and a hoe.
   - Mark internal open, powered, and crop-stage variants so they render and save without appearing as separate inventory choices.

2. **Add persistent interactive block state**
   - Store orientation and changing state by voxel coordinate.
   - Give chests 27 persistent slots and revision-checked writes so stale interfaces cannot overwrite newer contents.
   - Toggle doors and trapdoors, climb ladders, and let beds advance night to morning.

3. **Add voxel light calculations**
   - Calculate open-sky light and propagate emitted light through transparent voxels.
   - Use world coordinates so propagation naturally crosses chunk borders.
   - Render nearby light sources and use their levels when spawning nocturnal glow creatures.

4. **Add scheduled block updates and simple power**
   - Process a persistent update queue at a bounded interval.
   - Toggle switches and propagate power to adjacent lamps, rebuilding light when their state changes.

5. **Add farming**
   - Till grass or dirt with a hoe, plant seeds on farmland, and grow crops through four scheduled stages.
   - Make nearby water hydrate farmland and allow mature crops to be harvested for wheat and seeds.
   - Keep food as a crafting and friendship resource because this game intentionally has no player health or survival damage.

6. **Add feedback and polish**
   - Play synthesized footsteps and interaction sounds without requiring downloaded audio assets.
   - Show short-lived particles for placing, breaking, harvesting, power, and furnace smoke.
   - Render a held-item view that responds to walking and block actions.

7. **Validate and document**
   - Add focused tests for storage revisions, light crossing chunk boundaries, power, crop hydration/growth, and save migration.
   - Run the complete test suite and production build.
   - Mark Phase 9 complete and update the shortcut reference.

## Completion criteria

- Chests keep items through saves and reject stale edits.
- Doors and trapdoors toggle, ladders are climbable, and beds skip nighttime.
- Torch and powered-lamp light crosses chunk boundaries and affects nighttime spawning.
- Switches power neighboring lamps through the scheduled world simulation.
- Farmland hydration and crop planting, growth, and harvesting work end to end.
- Common actions have sound, particle, and held-item feedback.

