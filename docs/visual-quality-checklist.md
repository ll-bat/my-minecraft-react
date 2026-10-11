# Visual Quality Checklist

Use the visual test area and a normal generated world at view distances 2, 4, 6, and optional Extra 2x distance 9. Check daytime, nighttime, rain or snow, and underwater views where relevant.

## Blocks and atlases

- [ ] No seams appear between adjacent opaque blocks or across greedy-meshed surfaces.
- [ ] Textures repeat once per block and are not stretched across merged surfaces.
- [ ] Distant mipmaps do not sample neighboring atlas cells.
- [ ] Top, bottom, side, and directional faces use the intended artwork.
- [ ] Deterministic variants stay fixed after saving, loading, and revisiting a chunk.
- [ ] Grass, leaves, and water use suitable biome colors; grass dirt undersides remain untinted.
- [ ] Cutout edges remain crisp without colored halos.
- [ ] Glass, windows, ice, water, and lava render in stable separate translucent batches.
- [ ] Emissive blocks glow without washing out their surface detail.

## Shapes and objects

- [ ] Slabs, stairs, fences, walls, railings, posts, beams, doors, trapdoors, ladders, beds, torches, and lanterns have correct scale and rotation.
- [ ] Connected construction pieces update when a neighbor is placed or removed.
- [ ] Model objects sit on the ground without clipping, floating, or z-fighting.
- [ ] Collision, selection, and breaking outlines follow the visible shape.
- [ ] Inventory, hotbar, held-item, and dropped-item previews match the placed object.
- [ ] Placing, rotating, saving, loading, breaking, and collecting each shape preserves the expected item and state.

## Environment and performance

- [ ] Fog transitions fit the current biome, time, dimension, and fluid state.
- [ ] Face shading remains readable in sunlight and at night.
- [ ] Water, lava, portals, and powered lamps animate without visible atlas bleeding.
- [ ] F3 measurements settle within the distance-specific budgets in `docs/rendering-performance-budgets.md`.
- [ ] Moving and turning remain responsive while new chunks are generated and installed.
- [ ] Previously visible terrain remains present until replacement chunks are ready.

Run `npm run assets:validate` before release. It verifies every manifest output and external source, the checked-in CC0 license, power-of-two atlas dimensions, UV cell sizes, and exact two-pixel edge extrusion around every block texture.
