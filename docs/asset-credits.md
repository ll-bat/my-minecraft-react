# Asset Sources and Credits

## Kenney Voxel Pack

- **Creator:** Kenney Vleugels / Kenney
- **Source:** <https://kenney.nl/assets/voxel-pack>
- **Downloaded:** 2026-10-10
- **License:** Creative Commons Zero 1.0 (CC0)
- **Local path:** `src/images/assets/kenney-voxel-pack/`
- **Included:** 85 tile textures, 56 item illustrations, the original preview, and the original license file
- **Use:** Source art for terrain faces, building blocks, ores, foliage, fluids, crops, utility blocks, tools, and inventory items

The asset pipeline currently produces 79 block faces, 41 item and model-preview icons, and 20 original low-poly glTF models. It copies or derives matching Kenney art and generates project-specific functional faces, deterministic texture variants, missing item icons, models, and previews through checked-in scripts. Per-file provenance and transformations are recorded in `src/images/game/manifest.json`. The source license does not require attribution; this record is retained for project maintenance. `npm run assets:validate` verifies every source/output path, the CC0 license record, atlas dimensions, UV regions, and padding extrusion.

## Kenney Fish Pack 2.0

- **Creator:** Kenney
- **Source:** <https://kenney.nl/assets/fish-pack>
- **License:** Creative Commons Zero 1.0 (CC0)
- **Local path:** `src/images/assets/kenney-fish-pack/`
- **Included:** Blue, orange, and pink 128 × 128 fish illustrations, the original preview, and the original license

The selected illustrations are packed into the shared item atlas without visual changes and provide the shape and color reference for the corresponding project-built low-poly swimming models.

## Kenney Prototype Kit

- **Creator:** Kenney Vleugels / Kenney
- **Source:** <https://kenney.nl/assets/prototype-kit>
- **Downloaded:** 2026-10-11
- **License:** Creative Commons Zero 1.0 (CC0)
- **Local path:** `src/images/assets/kenney-prototype-kit/`
- **Included:** Animated horse GLB, its color map, and the original license
- **Use:** Friendly horse model and authored walking animation

The build pipeline embeds the horse color map into `src/images/game/creatures/horse.glb` so the browser loads one self-contained model file.

## Kenney Animated Characters Retro

- **Creator:** Kenney Vleugels / Kenney
- **Source:** <https://kenney.nl/assets/animated-characters-retro>
- **Downloaded:** 2026-10-11
- **License:** Creative Commons Zero 1.0 (CC0)
- **Local path:** `src/images/assets/kenney-animated-characters-retro/`
- **Included:** Base human FBX, idle and running animation FBX files, male and female skins, and the original license
- **Use:** Properly proportioned friendly human residents with skinned idle and walking animation

Human models are scaled to approximately 1.7 world units tall. Deterministic male and female variants give residents visual variety without adding per-frame geometry construction.

## Gobkit Owl

- **Creator:** Gobkit
- **Source:** <https://gobkit.com/freebies>
- **Downloaded:** 2026-10-11
- **License:** Creative Commons Zero 1.0 Universal (CC0)
- **Local path:** `src/images/assets/gobkit-owl/`
- **Use:** Small ambient birds that perch on generated tree crowns and make short flights

The game uses the source model's rigged idle animation while perched and blends to its more active animation during game-controlled takeoff, flight, and landing paths.

## 3DAssets.dev Aircraft Fleet and Airfield

- **Creator:** 3D Assets
- **Source:** <https://3dassets.dev/packs/aircraft-fleet-and-airfield>
- **Selected asset:** Low Wing Single, Gear Retracted
- **Downloaded:** 2026-10-11
- **License:** Creative Commons Zero 1.0 Universal (CC0)
- **Local path:** `src/images/assets/3dassets-aircraft/`
- **Use:** Distant ambient airplanes with animated propellers

The selected self-contained GLB is an unbranded in-flight model with 14,874 triangles. Four instances follow broad independent routes around the player's area, with enough separation to keep the sky readable.
