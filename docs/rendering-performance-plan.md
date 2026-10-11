# Rendering Performance Plan

**Status:** Complete. Background terrain generation and lighting, worker-built mesh buffers, nearest-first streaming, frame-budgeted activation, stale-result protection, persistence, the 1–4 selector, shared texture atlases, texture-preserving greedy meshing, transparent batch separation, and live F3 performance measurements are implemented.

## Goal

Keep movement and camera input smooth while terrain streams, including at render distance 4, without replacing visible terrain with empty space during loading.

## Implementation order

1. **Background terrain generation**
   - Generate terrain and structures in a Web Worker instead of the browser's main thread.
   - Keep a synchronous fallback for tests and browsers without Worker support.
   - Ignore obsolete worker results after the player changes chunks, dimensions, or worlds.

2. **Prioritized streaming**
   - Request the closest columns first.
   - Keep the previous view active until the new view is complete.
   - Preserve generated chunk data so returning to an explored area does not regenerate terrain.

3. **Frame-budgeted mesh activation**
   - Activate one vertical chunk mesh per animation frame.
   - Spread geometry creation and GPU uploads across frames instead of mounting a complete column at once.
   - Remove old edge chunks only after the replacement view is ready.

4. **Configurable render distance**
   - Add render-distance choices from 1 through 4 to the game menu.
   - Keep 4 (Ultra) as the default and persist the selected value with the world.

5. **Validation and optimization**
   - Test worker-equivalent generation, request cancellation, retained views, activation order, and persistence.
   - Build render and collision geometry in a second Web Worker, keeping the previous mesh active until its replacement is ready.
   - Calculate generated-column block lighting in the terrain worker.
   - Merge compatible opaque faces while retaining one atlas-tile repeat per voxel.
   - Track frame, renderer, worker, installation, memory, render-layer, and model-category measurements against distance 2 and 4 budgets.

## Completion criteria

- Keyboard and camera input continue updating during terrain generation.
- Newly completed terrain appears incrementally without clearing the existing horizon.
- Rapid travel cannot apply stale terrain from an earlier request.
- Render distances 1–4 can be changed while playing and survive save/reload.
- Browsers without Web Workers retain correct terrain through the fallback path.
- Chunk geometry and generated-column lighting do not block the browser's main thread.
