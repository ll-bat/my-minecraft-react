# Mini Minecraft

A browser-based Minecraft-style sandbox built with React, Three.js, React Three Fiber, Zustand, Cannon physics, Express, Prisma, and PostgreSQL.

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
npm --prefix server install
cp server/.env.example server/.env
docker compose up -d postgres
npm run db:deploy
npm run dev
```

The React client runs at `http://localhost:3000` and proxies `/api` to the Express server at `http://localhost:4000`. You can use an existing PostgreSQL server instead of Compose by changing `DATABASE_URL` in `server/.env`.

PostgreSQL is authoritative for worlds, player position, changed chunks, persistent entities, discoveries, markers, and data packs. Autosave writes dirty chunks every 2.5 seconds. On the first database-backed launch, valid browser saves are imported and their old `localStorage` records are removed only after the server acknowledges them.

Run the automated checks with:

```bash
CI=true npm test -- --watch=false
npm run build
npm run server:build
```

Backend integration tests delete their fixture worlds and therefore require a dedicated database whose name ends in `_test`:

```bash
docker compose exec postgres createdb -U minecraft minecraft_test
DATABASE_URL=postgresql://minecraft:minecraft@127.0.0.1:5432/minecraft_test npm run db:deploy
DATABASE_URL=postgresql://minecraft:minecraft@127.0.0.1:5432/minecraft_test npm --prefix server test
```

For production, build both applications, set `NODE_ENV=production` and `DATABASE_URL`, apply migrations with `npm run db:deploy`, then run `npm run server:start`. Express serves the compiled React application and API from one origin.

See the [PostgreSQL persistence design](docs/postgresql-persistence-plan.md), [feature roadmap](docs/features.md), and [codebase analysis](docs/codebase-analysis.md) for implementation details.
