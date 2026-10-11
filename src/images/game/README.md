# Game-ready visual assets

This directory is generated and maintained by `scripts/build_texture_atlases.py`.

- `blocks/` contains individual 128 × 128 block faces for review and derivative work.
- `atlases/` contains four block render-layer atlases, the item atlas, and their metadata.
- `manifest.json` records each output's source, license, render layer, and transformation.
- `items/` contains generated game-ready tool, material, creature-item, and model-preview illustrations.
- `models/` contains twenty generated embedded glTF objects and previews used by the instanced model renderer.

Run:

```bash
npm run assets:build
```

The script requires Python 3 and Pillow. Never edit atlas PNG files or `blocks.json` directly because the next build replaces them.
