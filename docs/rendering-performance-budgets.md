# Rendering Performance Budgets

Phase 9 adds live, hardware-specific measurements to the F3 overlay. Let the view settle for several seconds after changing distance so terrain and mesh queues finish. Visit the same location at distance 2 and distance 4; the overlay retains the most recent summary for both distances during the session.

| Metric | Distance 2 budget | Distance 4 budget |
| --- | ---: | ---: |
| Average frame time | 20 ms | 24 ms |
| Draw calls | 180 | 360 |
| Rendered triangles | 800,000 | 1,800,000 |
| Estimated active geometry buffers | 192 MB | 320 MB |
| Worker mesh build p95 | 35 ms | 50 ms |
| Main-thread mesh install p95 | 7 ms | 10 ms |

The frame figures are responsiveness targets rather than guaranteed rates on every device. Browser, GPU, display refresh rate, weather, visible fluids, creatures, and the number of player-built objects all affect the result.

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
