# Asset Sources and Credits

## Kenney Voxel Pack

- **Creator:** Kenney Vleugels / Kenney
- **Source:** <https://kenney.nl/assets/voxel-pack>
- **Downloaded:** 2026-10-10
- **License:** Creative Commons Zero 1.0 (CC0)
- **Local path:** `src/images/assets/kenney-voxel-pack/`
- **Included:** 85 tile textures, 56 item illustrations, the original preview, and the original license file
- **Use:** Source art for terrain faces, building blocks, ores, foliage, fluids, crops, utility blocks, tools, and inventory items

The asset pipeline currently produces 79 block faces, 38 item and model-preview icons, and 20 original low-poly glTF models. It copies or derives matching Kenney art and generates project-specific functional faces, deterministic texture variants, missing item icons, models, and previews through checked-in scripts. Per-file provenance and transformations are recorded in `src/images/game/manifest.json`. The source license does not require attribution; this record is retained for project maintenance. `npm run assets:validate` verifies every source/output path, the CC0 license record, atlas dimensions, UV regions, and padding extrusion.
