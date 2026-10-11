# Rendering Performance Budgets

Phase 9 adds live, hardware-specific measurements to the F3 overlay. Let the view settle for several seconds after changing distance so terrain and mesh queues finish. Visit the same location at distance 2, distance 4, distance 6, and optional distance 9; the overlay retains the most recent summary for each distance during the session.

| Metric | Distance 2 budget | Distance 4 budget | Distance 6 budget | Distance 9 budget |
| --- | ---: | ---: | ---: | ---: |
| Average frame time | 20 ms | 24 ms | 30 ms | 36 ms |
| Draw calls | 180 | 360 | 600 | 900 |
| Rendered triangles | 800,000 | 1,800,000 | 3,200,000 | 5,000,000 |
| Estimated active geometry buffers | 192 MB | 320 MB | 512 MB | 768 MB |
| Worker mesh build p95 | 35 ms | 50 ms | 70 ms | 90 ms |
| Main-thread mesh install p95 | 7 ms | 10 ms | 14 ms | 18 ms |

The frame figures are responsiveness targets rather than guaranteed rates on every device. Browser, GPU, display refresh rate, weather, visible fluids, creatures, and the number of player-built objects all affect the result.

Extra uses a rounded 137-column footprint with a full six-chunk reach on the north, south, east, and west axes. Extra 2x uses the same policy with a nine-chunk reach and 277 columns, approximately twice Extra's terrain. Physics bodies stay within two horizontal and two vertical chunks of the player, pointer raycasting stays within one chunk, and detailed model objects stay within distance 4. These limits move with the player and do not change saved world data.

Dense settlements progressively install nearby collision bodies one per animation frame. Model positions are cached per chunk, and only the eight closest emitted block lights become real-time point lights; other lanterns retain their emissive artwork. This prevents cities from causing a one-frame physics burst or multiplying standard-material lighting work.

## Category budgets

| Render layer | Triangle budget |
| --- | ---: |
| Opaque | 1,200,000 |
| Cutout | 300,000 |
| Translucent | 200,000 |
| Emissive | 100,000 |
| Instanced models | 250,000 |

| Object category | Triangle budget |
| --- | ---: |
| Furniture | 100,000 |
| Interior decor | 90,000 |
| Outdoor decor | 60,000 |

The overlay reads renderer draw calls, rendered triangles, geometry and texture allocations, and frame times directly from Three.js. It combines those values with worker build timing, main-thread geometry installation timing, typed-buffer sizes, render-layer totals, and instanced model geometry. Measurements update twice per second without triggering chunk rebuilds.

Greedy meshing applies only to compatible full opaque blocks. Faces must have the same direction, atlas region, biome tint, collision boundary state, and lighting shade. Partial shapes, cutout art, emissive blocks, fluids, and translucent surfaces keep independent quads. Atlas rectangle attributes repeat the source face once per voxel across a merged quad.
