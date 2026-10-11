# Visual Style Guide

## Direction

The game uses a clean, colorful voxel style with readable silhouettes and moderate surface detail. Common terrain starts from the CC0 Kenney Voxel Pack; project-specific magic, utility blocks, furniture, creatures, and interface art should match its soft geometric shading.

## Palette

| Family | Shadow | Base | Highlight |
| --- | --- | --- | --- |
| Soil | `#76502f` | `#a8733e` | `#d29a55` |
| Stone | `#4d6265` | `#789092` | `#b3c4c2` |
| Wood | `#65401f` | `#a56b32` | `#d59a50` |
| Foliage | `#167a45` | `#20b963` | `#55dc83` |
| Water | `#4b91ad` | `#82c9df` | `#c7f2fa` |
| Lava | `#c84b12` | `#f27418` | `#ffc029` |
| Crystal | `#2d9bad` | `#55d2dc` | `#b8fbf7` |
| Magic | `#39214f` | `#71499b` | `#c58bea` |

These colors are anchors rather than strict limits. New art should keep similar saturation and contrast so it fits existing assets.

## Block textures

- Game-ready faces are 128 × 128 RGBA PNG files.
- Top, bottom, and side faces may differ. Directional blocks may override north, south, east, and west.
- Opaque, cutout, translucent, and emissive art use separate atlases.
- Transparent textures use straight alpha.
- Important details should remain readable when shown in a 48-pixel inventory slot.
- Avoid lighting painted from a fixed world direction. Small local highlights are acceptable.
- Preserve a two-pixel safe edge when authoring derivatives so atlas padding can prevent bleeding.

## Models and shapes

- One block occupies one world unit.
- Models use Y-up coordinates and a centered placement origin.
- Repeated building shapes use worker-generated cuboids whenever possible.
- Sparse decorative objects may use glTF models with simple collision boxes.
- Each repeated decorative model should prefer one merged vertex-colored mesh so it can use instanced rendering.
- Model colors follow the project palette; textured models may reuse project atlases when surface detail requires them.

## Environmental variation

- Natural texture variants are selected deterministically from the world seed and voxel position, so a saved world never changes appearance between sessions.
- Grass and leaf colors follow the local biome. Water uses a quieter biome tint while keeping one shared source texture.
- Top faces are brightest, bottom faces are darkest, and horizontal faces use restrained directional shading for readable depth.
- Fluid, portal, and powered-block animation stays within the atlas padding and updates at a low fixed rate.
- Translucent materials use lower roughness than opaque terrain; emissive art supplies its own glow map and a restrained pulse.

## Asset locations

- `src/images/assets/`: immutable third-party source assets and their licenses.
- `src/images/game/blocks/`: selected or derived game-ready block faces.
- `src/images/game/atlases/`: generated atlas images and UV metadata.
- `src/images/game/items/`: game-ready item illustrations and generated model previews.
- `src/images/game/models/`: generated low-poly glTF objects and their preview sources.
- `src/images/game/manifest.json`: generated provenance and transformation data.

Run `npm run assets:build` after changing the source mapping or any game-ready block source.
