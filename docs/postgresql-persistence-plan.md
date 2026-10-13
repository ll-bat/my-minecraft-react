# PostgreSQL Persistence Implementation Plan

**Status:** Planned

## Goal

Replace browser `localStorage` world persistence with a small Express 5 and Prisma ORM 7 backend backed by PostgreSQL. Keep the existing React and Zustand game frontend, preserve all current world-management behavior, and autosave only state that changed instead of serializing and uploading the complete generated world every 2.5 seconds.

The first release remains single-player. It uses HTTP requests rather than WebSockets and assumes the backend is private or local until authentication is added.

## Decisions

- Keep the existing Create React App frontend.
- Add a TypeScript Express server under `server/` in the same repository.
- Use Prisma ORM 7 with PostgreSQL and pin the major version explicitly.
- Use Zod at the HTTP boundary even though Prisma validates database operations.
- Keep one autosave request in flight at a time and batch changes made while it runs into the next request.
- Store deterministic terrain by seed and store player changes by chunk. Do not save an entire regenerated world snapshot on every interval.
- Use optimistic world revisions, idempotent batch IDs, and database transactions to prevent retries or stale requests from overwriting newer progress.
- Keep WebSockets out of this phase. They are only justified later for multiplayer or other live server-to-client events.

## Target repository layout

```text
my-minecraft-react/
├── src/                         # Existing React game
├── server/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── app.ts
│   │   ├── index.ts
│   │   ├── config.ts
│   │   ├── db.ts
│   │   ├── routes/
│   │   │   ├── health.ts
│   │   │   └── worlds.ts
│   │   ├── services/
│   │   │   └── worldService.ts
│   │   └── validation/
│   │       └── worldSchemas.ts
│   ├── tests/
│   ├── package.json
│   └── tsconfig.json
├── docs/
└── package.json
```

## Data model

### `World`

Store the stable world identity and settings:

- ID, name, seed, generator version, save-format version, creation date, last-played date, and current revision.
- An incarnation ID that changes whenever the same world record is reset, causing autosaves from its previous incarnation to be rejected.
- Game rules, enabled data packs, goals, and other world-level settings.
- A cascade relationship to player, dimension, chunk, entity, and discovery records.

### `PlayerState`

Use one row per world for:

- Position, heading, active dimension, mounted entity ID, selected hotbar slot, and game mode.
- Inventory, survival inventory, crafting grids, render distance, and selected block.
- Other small player-owned values that travel between dimensions.
- A monotonically increasing position version so a delayed page-hide request cannot replace a newer position.

### `DimensionState`

Use one row for each world and dimension pair for:

- Last player position, world time, weather state, and dimension settings.
- Compact state that cannot be derived safely.
- Do not persist `generatedColumns` or `spawnedCreatureGroups` as if their content were materialized. They remain runtime caches and start empty after loading because untouched terrain and deterministic spawn groups are regenerated from the seed.
- A unique key on `(worldId, dimension)`.

### `ChunkState`

Use one row for every player-modified chunk:

- World ID, dimension, chunk X/Y/Z, revision, and updated date.
- A complete authoritative palette-and-run snapshot of that 16 × 16 × 16 chunk after the first player change.
- Fluid levels, block states, block entities, and scheduled block updates belonging to that chunk.
- A unique key on `(worldId, dimension, chunkX, chunkY, chunkZ)`.

Terrain, buildings, rivers, stadiums, cities, forests, and other deterministic generation remain reproducible from the seed. A generated chunk is written only after gameplay changes it or it receives non-deterministic persistent state. Saving the complete changed chunk rather than only its remaining blocks preserves removed-block information without requiring tombstones: after base generation, the saved snapshot replaces that exact generated chunk.

Dirty chunk identity is tracked separately from the in-memory `chunks` map. If a player removes every block and the map drops that chunk key, autosave must still write an explicit empty authoritative snapshot so generated blocks do not return after reload.

### `EntityState`

Store player-created or meaningfully changed creatures, vehicles, villagers, drops that must survive reloads, and their dimension/chunk location. Index by world, dimension, chunk X, and chunk Z so loading nearby entities does not scan the full world.

- Deterministically generated entities keep their stable generated IDs. A saved row overrides the regenerated entity with that ID.
- Destroying a generated entity stores a deletion tombstone so it cannot reappear during regeneration.
- Destroying a player-created entity can delete its row because no generator will recreate it.
- Routine wandering and animation of untouched wildlife need not create database writes. Placement, destruction, friendship, trades, gifts, tasks, mounting, and vehicle movement do.

### `WorldDiscovery`

Use small normalized records instead of rewriting a growing JSON document:

- `ExploredColumn` with a unique key on `(worldId, dimension, chunkX, chunkZ)`.
- `DiscoveredBiome` with a unique key on `(worldId, dimension, biomeId)`.
- `DiscoveredStructure` with its stable structure ID and validated metadata.
- `WorldMarker` with its name, color, dimension, and position.

Autosave inserts only newly discovered records and sends marker upserts or deletions. Goals and compact settings can remain JSON on `World` because they are small and bounded.

### `DataPack`

Store imported pack metadata and validated source JSON. Relate enabled packs to worlds so the final system does not depend on the existing data-pack `localStorage` key.

## API contract

### Service status

- `GET /api/health` verifies that Express and PostgreSQL are reachable.

### World management

- `GET /api/worlds` lists world metadata ordered by last played time.
- `POST /api/worlds` creates a fresh world.
- `GET /api/worlds/:worldId` loads world metadata and player state.
- `DELETE /api/worlds/:worldId` deletes the world and related rows transactionally.
- `POST /api/worlds/:worldId/duplicate` duplicates the complete saved state.
- `POST /api/worlds/:worldId/reset` transactionally removes saved progress, changes the incarnation ID, and recreates the world with either its existing seed for Regenerate or a supplied seed for the main-menu New World action.
- `GET /api/worlds/:worldId/export` returns the existing versioned export format or its documented successor.
- `POST /api/worlds/import` validates and imports an exported world.

### Streaming world state

- `GET /api/worlds/:worldId/regions?dimension=...&minX=...&maxX=...&minZ=...&maxZ=...` loads changed chunks and persistent entities around the player.
- `PATCH /api/worlds/:worldId/autosave` writes a batch containing the incarnation ID, a unique batch ID, expected revision, player state, changed world-level state, dirty chunks, entity upserts, and entity deletions.
- `PATCH /api/worlds/:worldId/player` performs a small final player-position save when the page becomes hidden and accepts it only when its position version is newer.

Every transactional write returns the accepted world revision. The `World` row retains the last accepted autosave batch ID; because the client permits only one autosave request at a time, retrying that ID returns its previous success without applying the batch twice. The server checks a repeated batch ID before checking its now-stale expected revision. New writes claim a revision with an atomic compare-and-swap inside the transaction rather than a separate read followed by an update. Validation limits the number of chunks and entities per request, coordinate ranges, JSON depth, string sizes, and total body size.

## Implementation order

### 1. Establish the server workspace

- Add `server/package.json`, strict TypeScript configuration, Express 5, Zod, Prisma 7, the Prisma PostgreSQL adapter, and development tooling.
- Pin Prisma 7 packages so an install cannot silently switch to the Prisma 8 release-candidate workflow.
- Add environment validation for `DATABASE_URL`, `PORT`, `CLIENT_ORIGIN`, and production mode.
- Add `/api/health`, centralized JSON errors, request IDs, body-size limits, and graceful shutdown.
- Add root scripts for `dev:client`, `dev:server`, combined `dev`, server migration, production build, and production start.
- Proxy `/api` from the React development server to Express. In production, let Express serve the compiled React files and keep both sides on one origin.
- Add an optional development `compose.yaml` for PostgreSQL while continuing to support any externally managed PostgreSQL instance through `DATABASE_URL`.

**Checkpoint:** One repository command starts the frontend and backend, and the health route confirms a working PostgreSQL connection.

### 2. Define and migrate the database

- Create the Prisma models and their cascade relationships, compound unique constraints, and regional indexes.
- Generate and review the initial migration before applying it.
- Create one shared Prisma client per server process and disconnect it during shutdown.
- Add a development seed only for test worlds; never seed production gameplay data automatically.
- Document local PostgreSQL setup, environment variables, migration development, and production migration commands.

**Checkpoint:** Prisma can create, query, update, and transactionally delete a complete minimal world.

### 3. Build and test world-management endpoints

- Implement list, create, load, delete, regenerate, duplicate, export, and import services.
- Put transaction and persistence logic in `worldService.ts`; keep route handlers limited to HTTP parsing and responses.
- Validate all route parameters and request bodies with Zod.
- Preserve the current semantics: New World and Regenerate begin from fresh generated state, deletion cascades safely, and duplication receives a new ID.
- Map World Manager creation to a new database world. Map the main-menu New World action to resetting the active world with a requested seed, and Regenerate to resetting it with the existing seed.
- Return consistent error bodies for validation failure, missing worlds, revision conflicts, unavailable database connections, and unexpected failures.

**Checkpoint:** The existing World Manager operations can be expressed completely through the API without browser persistence.

### 4. Separate generated terrain from saved changes

- Add dirty-chunk tracking beside the existing `chunkRevisions` bookkeeping.
- Mark chunks dirty for block placement/removal, bridges, fluids, crops, doors, functional block state, and other persistent edits.
- Do not mark chunks dirty merely because deterministic terrain streamed into view.
- Give persistent edit functions an explicit gameplay, simulation, restoration, or generation origin so generation and database restoration cannot accidentally enter the dirty-save queue.
- Treat `generatedColumns` as a session-only cache: begin empty after a database load and add entries only when their base terrain has actually been regenerated in memory.
- Partition block states and block entities by chunk for loading and saving.
- Track persistent entity upserts and deletion tombstones independently from generated ambient entities. Merge a stored deterministic entity by stable ID instead of adding a duplicate.
- Reuse the existing palette-and-run chunk encoding for database payloads.
- Extend that encoding to represent an explicitly saved empty chunk; do not interpret an empty snapshot as a missing database record.
- Make loading order explicit: generate the seeded base chunk first, then replace that exact chunk with its saved authoritative snapshot before exposing its collision mesh.

**Checkpoint:** Traveling through untouched terrain produces no database chunk rows, while an edited chunk restores exactly after reload.

### 5. Add the frontend API and initial loading flow

- Create a small `src/api/` client with typed request/response shapes, timeouts, and normalized errors.
- Replace synchronous startup from `readWorld()` with an explicit loading state.
- Select the most recently played world when no world is active in memory; opening a world updates `lastPlayedAt`, so active-world selection does not require browser storage.
- If the database has no ready worlds and there is no legacy world to migrate, create the default world through the API before entering gameplay.
- Load and validate the world's enabled data packs before decoding any chunk or inventory state that may reference their custom IDs.
- Load world metadata, goals, discoveries, markers, and player state first, then request saved regions surrounding the restored player position. Terrain generation must see existing discoveries before it can award structure progress.
- Request additional saved regions as the player crosses chunk boundaries and merge each response only into its matching world, dimension, and request generation.
- Record each chunk's local edit version when a region request begins. Apply its response only if that chunk is still unedited at the same version; otherwise preserve the local chunk and keep it dirty.
- Keep collision readiness disabled for a restored region until generated terrain and database overrides have both been applied.
- Keep placement, mining, and entity interaction disabled in a region until its database response has been applied, so the player cannot edit a base chunk while its saved snapshot is still arriving.
- Use the world's persisted generator version when reproducing base terrain. A generator change must either retain the older generator or provide an explicit world migration; it must not silently alter existing seed-based worlds.
- On dimension travel, retain outgoing dirty records under their original dimension, load the destination's last position and surrounding saved regions, and restore a mount only after its entity row is available. Never discard one dimension's unsaved queue while entering another.
- Show loading, reconnecting, unsaved, saved, and save-error status without pausing the render loop.

**Checkpoint:** Refreshing the browser restores the selected database world, player position, nearby edits, entities, inventory, and dimension.

### 6. Replace autosave with a durable save queue

- Change `saveWorld` into an asynchronous database operation.
- Keep dirty records in memory with monotonically increasing local versions.
- Every 2.5 seconds, take a snapshot of the current dirty set and submit one `PATCH /autosave` request.
- Give that snapshot a unique batch ID and reuse the same ID for every retry of the same batch.
- Permit only one request at a time. Changes made during that request stay dirty for the next batch.
- Clear only records acknowledged by the server; never clear newer changes that share the same chunk or entity ID.
- Retry transient failures with bounded exponential backoff and show that progress is not yet saved.
- On a revision conflict, keep the local dirty batch in memory, pause automatic writes, and show a conflict state with reload and export options. Do not automatically rebase a complete authoritative chunk snapshot over a newer database revision.
- Reject every batch whose incarnation ID no longer matches, so an in-flight save cannot restore deleted progress after New World, Regenerate, or world deletion.
- Increment the player-position version when capturing a position for an autosave or page-hide request, rather than on every movement frame. On `visibilitychange` or `pagehide`, use a small keepalive request containing the latest position and version; both endpoints update the player row only when their version is newer. The small player-only endpoint does not advance the world revision. Immediately queue remaining world changes when the page resumes.
- Make the manual Save button force an immediate queue flush and report success only after every batch present at the time of the click is acknowledged.
- Allow a batch to contain dirty records from more than one dimension so travel does not require dropping or rewriting the outgoing dimension's pending changes.
- Keep saving and serialization outside the animation frame and terrain-rendering work.

**Checkpoint:** Repeated edits during slow requests are not lost, duplicate requests are idempotent, and saving does not interrupt gameplay.

### 7. Move world-management UI to the API

- Make World Manager list, open, create, duplicate, delete, export, and import actions asynchronous.
- Replace `window.location.reload()` world switching with a controlled store reset and database load where practical.
- Make New World and Regenerate delete previous persisted progress on the server before initializing fresh state.
- Before opening another world, flush the active world's queue and stop the switch if that flush fails. Flush the active world before duplicating or exporting it so those operations include all acknowledged progress.
- When deleting or resetting the active world, invalidate and cancel its local queue first; the server-side incarnation check remains the final protection against a request already in transit.
- Disable conflicting buttons while an operation is active and display actionable server errors.
- Preserve the current JSON export capability as a user-controlled backup independent of the database.

**Checkpoint:** No world-management action reads or writes the local world catalog.

### 8. Migrate existing browser saves once

- Detect the current world catalog and version-9 documents during the transition release.
- On an empty database, attempt legacy discovery before creating a default world. After migration, preserve the previously active local world as the most recently played database world.
- Parse them with the existing migration and normalization code before upload.
- Create each valid local world through a dedicated, idempotent migration endpoint, then upload its chunks and entities in bounded resumable batches rather than one potentially oversized request.
- Keep a migrating world in an `IMPORTING` database status and exclude it from normal world opening until a finalization transaction verifies all expected batches and marks it `READY`.
- Import all chunk snapshots found in a legacy document as authoritative because the version-9 format does not distinguish generated chunks from player-modified chunks. New database-native worlds use dirty tracking and store only changed chunks.
- Record the legacy world ID as an import key so refreshing during migration cannot create duplicates.
- Delete legacy world documents, catalog keys, and active-world keys only after the server acknowledges every imported world.
- Preserve invalid local data and show an export/retry option instead of deleting it.
- Remove the migration code after a documented compatibility window rather than carrying it indefinitely.

**Checkpoint:** Existing players retain their worlds, positions, inventory, entities, dimensions, discoveries, and edits after switching to PostgreSQL.

### 9. Remove browser persistence

- Remove `worldCatalog.js` storage writes and direct `localStorage` usage from `worldStorage.js`, `AutoSave`, World Manager, and their tests.
- Move imported data packs to PostgreSQL and remove their browser-storage key.
- Retain pure serialization, parsing, validation, and export helpers because they remain useful at the API boundary.
- Verify with a repository search that gameplay progress no longer depends on `localStorage`.

**Checkpoint:** Clearing browser storage does not remove or reset a database world.

### 10. Validate reliability, security, and performance

- Test Prisma services against a dedicated PostgreSQL test database.
- Test HTTP validation, transactions, cascade deletion, revision conflicts, idempotent batch retries, stale position rejection, regional loading, duplication, regeneration, import, and export.
- Test the frontend save queue with delayed, failed, reordered, and repeated responses.
- Test a migration from the current version-9 local world format.
- Test removing a naturally generated block and verify that the removed block remains absent after its authoritative changed-chunk snapshot is restored.
- Test removing every block from a generated chunk and verify that its explicit empty snapshot prevents the generated chunk from returning.
- Test destroying a deterministic creature and verify that its deletion tombstone prevents it from respawning.
- Test that an autosave delayed across New World or Regenerate is rejected by the new incarnation ID and cannot recreate old blocks or entities.
- Test that runtime `generatedColumns` are rebuilt only with regenerated terrain and cannot suppress base generation after reload.
- Test that a delayed region response cannot overwrite a block edited locally after that request began.
- Test that an interrupted legacy import remains hidden, resumes without duplicate rows, and becomes visible only after finalization.
- Test reload while riding, after changing dimensions, after editing multiple chunks, and while an autosave is in flight.
- Test dimension travel with unsaved edits on both sides and verify that each edit is written under the correct dimension.
- Measure autosave payload size, database query duration, region-load latency, and main-thread time.
- Confirm dense-city editing and Extra 2x rendering remain smooth while autosaves run.
- Bind a local-only deployment to localhost. Before exposing it publicly, add authentication, authorization, HTTPS, rate limits, and per-user world ownership.

**Checkpoint:** Backend failures cannot corrupt acknowledged progress, and normal saving adds no visible gameplay pause.

## Delivery sequence

1. **Backend foundation:** Express, Prisma, PostgreSQL, migrations, and health checks.
2. **World API:** transactional CRUD, import/export, duplication, and regeneration.
3. **Incremental persistence:** dirty chunks and entities, regional loading, and revisioned autosaves.
4. **Frontend migration:** asynchronous startup, save queue, world manager, and error states.
5. **Compatibility:** one-time local save import followed by removal of browser persistence.
6. **Hardening:** integration tests, failure recovery, performance budgets, and deployment documentation.

## Out of scope

- Multiplayer, WebSockets, chat, presence, server-authoritative movement, and conflict merging between simultaneous players.
- Public account registration, passwords, social login, permissions, and world sharing.
- Offline play or an IndexedDB-backed offline write queue.
- Migrating the React frontend to Next.js.

## Completion criteria

- Starting the repository launches the React client and Express API with documented commands.
- PostgreSQL is the authoritative store for all worlds, player progress, changed chunks, persistent entities, discoveries, and data packs.
- Autosave sends bounded dirty batches instead of a complete world document.
- A refresh or later browser session restores the last acknowledged position and nearby world state.
- New World, Regenerate, duplicate, delete, import, and export preserve their intended behavior.
- Existing valid local worlds migrate exactly once without data loss.
- Clearing `localStorage` does not affect saved gameplay.
- Database outages produce a visible unsaved state and safe retries rather than silent loss.
- Saving and regional loading remain smooth in dense areas and at the largest render distance.
