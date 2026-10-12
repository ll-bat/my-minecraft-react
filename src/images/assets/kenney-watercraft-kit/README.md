# Kenney Watercraft Kit

This directory contains a curated copy of two models and their previews from Kenney's **Watercraft Kit 2.1**.

- Source: https://kenney.nl/assets/watercraft-kit
- Creator: Kenney
- License: Creative Commons Zero 1.0 (CC0)
- Downloaded: 2026-10-12

Included assets:

- `boat-row-large.glb` and `boat-row-large.png`
- `ship-small.glb` and `ship-small.png`
- `colormap.png`, shared by both source models

The original license is preserved in `LICENSE.txt`.

The source GLBs refer to the colormap by a relative path. `scripts/build_watercraft_models.py`
embeds that texture into self-contained copies under `src/images/game/vehicles/` for reliable
loading from Webpack's fingerprinted production paths.
