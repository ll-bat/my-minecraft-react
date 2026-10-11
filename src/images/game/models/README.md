# Game-ready object models

This directory contains the optimized embedded glTF decorative objects generated during Phase 7. Each file contains one vertex-colored mesh so repeated placements can share geometry and material through an instanced draw call. `previews/` is generated from the same cuboid definitions for the inventory catalog.

Models follow the scale and origin conventions in `docs/visual-style-guide.md`. Edit `scripts/build_models.py`, then run `npm run assets:build`; do not edit generated glTF or preview files directly.
