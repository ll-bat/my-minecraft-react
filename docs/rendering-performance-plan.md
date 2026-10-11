# Rendering Performance Plan

**Status:** Complete. Background terrain generation and lighting, worker-built mesh buffers, nearest-first streaming, frame-budgeted activation, stale-result protection, persistence, the Low-through-Ultra selector plus optimized Extra distances 6 and 9, shared texture atlases, texture-preserving greedy meshing, transparent batch separation, and live F3 performance measurements are implemented.

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
   - Add render-distance choices from 1 through 4, 6 (Extra), and 9 (Extra 2x) to the game menu.
   - Keep 4 (Ultra) as the default and persist the selected value with the world.

5. **Validation and optimization**
   - Test worker-equivalent generation, request cancellation, retained views, activation order, and persistence.
   - Build render and collision geometry in a second Web Worker, keeping the previous mesh active until its replacement is ready.
   - Calculate generated-column block lighting in the terrain worker.
   - Merge compatible opaque faces while retaining one atlas-tile repeat per voxel.
   - Track frame, renderer, worker, installation, memory, render-layer, and model-category measurements against distance 2 and 4 budgets.
   - Keep Extra's six-chunk reach while rounding its least visible corners, reducing active columns from 169 to 137.
   - Give Extra 2x a nine-chunk reach and a rounded 277-column footprint, almost exactly twice Extra instead of a 361-column square.
   - Create physics bodies only for nearby chunks and register pointer interaction only for reachable chunks.
   - Send only neighboring boundary layers to the mesh worker and cache immutable block definitions in the worker.
   - Render detailed GLTF object batches through distance 4 while Extra terrain continues through distance 6 or 9.
   - Cache model locations per immutable chunk, progressively install nearby collision bodies, and limit dense areas to the eight nearest real-time block lights.
   - Upgrade an existing city district by cloning only its source column instead of copying every generated chunk in the world.

## Completion criteria

- Keyboard and camera input continue updating during terrain generation.
- Newly completed terrain appears incrementally without clearing the existing horizon.
- Rapid travel cannot apply stale terrain from an earlier request.
- Render distances 1–4, Extra distance 6, and Extra 2x distance 9 can be changed while playing and survive save/reload.
- Browsers without Web Workers retain correct terrain through the fallback path.
- Chunk geometry and generated-column lighting do not block the browser's main thread.
