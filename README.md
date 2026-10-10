# Mini Minecraft

A browser-based Minecraft-style sandbox built with React, Three.js, React Three Fiber, Zustand, and Cannon physics.

Worlds are generated deterministically from text seeds and managed as independent saves. They include chunked terrain, biomes, caves, rare ores, localized lakes, weather, structures, exploration maps, peaceful goals, crafting, enchanting, portals to the Dream Grove, validated data packs, and persistent friendly creatures. The player has no health or death state, and creatures cannot attack or be attacked.

## Controls

| Input | Action |
| --- | --- |
| Click the world | Lock the pointer and look around |
| W / A / S / D | Move |
| Space | Jump |
| Space / Shift while submerged | Swim up / down |
| Left-click and hold | Break a block |
| Right-click | Use a crafting table or furnace, otherwise place the selected block |
| Click a creature | Pet and befriend it |
| 1–9 or mouse wheel | Select a hotbar slot |
| E | Open or close the inventory |
| Escape | Release the pointer |

Blocks can only be changed within reach. Every world supplies the full block catalog for unlimited placement. Open the inventory for 2 × 2 crafting, or right-click a crafting table for 3 × 3 recipes. Matching tools mine faster and wear down in survival mode. Furnaces smelt iron ore and sand using coal, logs, or planks. Creative mode breaks blocks instantly without damaging tools.

Sheep and rabbits wander peacefully during the day, while glow sprites appear at night. Petting a creature raises its friendship, produces heart feedback, may provide a small gift, and makes it calmly follow while keeping personal space. Creatures never attack, damage, aggressively chase, or flee from the player.

## Development

```bash
npm install
npm start
```

Run the automated checks with:

```bash
CI=true npm test -- --watch=false
npm run build
```

See the [feature roadmap](docs/features.md), [Phase 8 plan](docs/phase-8-plan.md), and [codebase analysis](docs/codebase-analysis.md) for implementation details and planned work.
