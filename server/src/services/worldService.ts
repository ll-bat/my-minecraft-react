import {randomUUID} from "node:crypto";
import {Prisma} from "../../generated/prisma/client.js";
import type {Database} from "../db.js";
import {HttpError} from "../errors.js";
import type {AutosaveInput, CreateWorldInput, ImportWorldInput, PlayerSaveInput, RegionQuery, ResetWorldInput} from "../validation/worldSchemas.js";

const publicWorld = (world: {id: string; name: string; seed: string; revision: number; incarnationId: string; createdAt: Date; lastPlayedAt: Date; settings: unknown}) => ({
    id: world.id, name: world.name, seed: world.seed, revision: world.revision,
    incarnationId: world.incarnationId, createdAt: world.createdAt, lastPlayedAt: world.lastPlayedAt,
    settings: world.settings,
});
const json = (value: unknown) => value as Prisma.InputJsonValue;
const nullableJson = (value: unknown) => value === null ? Prisma.JsonNull : json(value);
const withoutIds = <T extends Record<string, unknown>>(value: T) => {
    const {id: _id, worldId: _worldId, updatedAt: _updatedAt, ...rest} = value;
    return rest;
};
const positionChunk = (value: unknown) => {
    if (typeof value !== "string") return null;
    const parts = value.split(",").map(Number);
    return parts.length === 3 && parts.every(Number.isFinite)
        ? [Math.floor(parts[0]! / 16), Math.floor(parts[1]! / 16), Math.floor(parts[2]! / 16)]
        : null;
};

export class WorldService {
    constructor(private database: Database) {}

    async list() {
        const worlds = await this.database.world.findMany({where: {status: "READY"}, orderBy: {lastPlayedAt: "desc"}});
        return worlds.map(publicWorld);
    }

    async create(input: CreateWorldInput) {
        const worldId = input.id ?? `world-${Date.now()}-${randomUUID().slice(0, 8)}`;
        const incarnationId = randomUUID();
        try {
            const world = await this.database.world.create({data: {
                id: worldId, name: input.name, seed: input.seed, incarnationId, settings: json(input.settings),
                ...(input.player ? {player: {create: {position: json(input.player.position), positionVersion: input.player.positionVersion, state: json(input.player.state)}}} : {}),
            }});
            return publicWorld(world);
        } catch (error: unknown) {
            if ((error as {code?: string}).code === "P2002") throw new HttpError(409, "WORLD_EXISTS", "A world with this ID already exists");
            throw error;
        }
    }

    async bootstrap(worldId: string) {
        const world = await this.database.world.findFirst({where: {id: worldId, status: "READY"}, include: {
            player: true, dimensions: true, exploredColumns: true, discoveredBiomes: true,
            discoveredStructures: true, markers: true, enabledPacks: {include: {dataPack: true}},
        }});
        if (!world) throw new HttpError(404, "WORLD_NOT_FOUND", "World not found");
        await this.database.world.update({where: {id: worldId}, data: {lastPlayedAt: new Date()}});
        return {
            world: publicWorld(world),
            player: world.player,
            dimensions: world.dimensions.map(({dimension, state}) => ({dimension, state})),
            exploredColumns: world.exploredColumns.map(({dimension, chunkX, chunkZ}) => ({dimension, chunkX, chunkZ})),
            discoveredBiomes: world.discoveredBiomes.map(({dimension, biomeId}) => ({dimension, biomeId})),
            discoveredStructures: world.discoveredStructures.map(({structureId, dimension, data}) => ({structureId, dimension, data})),
            markers: world.markers.map(({id, dimension, name, color, position}) => ({id, dimension, name, color, position})),
            dataPacks: world.enabledPacks.map(({dataPack}) => dataPack.source),
        };
    }

    async export(worldId: string) {
        const world = await this.database.world.findFirst({where: {id: worldId, status: "READY"}, include: {
            player: true, dimensions: true, chunks: true, entities: true, exploredColumns: true,
            discoveredBiomes: true, discoveredStructures: true, markers: true, enabledPacks: true,
        }});
        if (!world) throw new HttpError(404, "WORLD_NOT_FOUND", "World not found");
        return {
            format: "minecraft-react-database-export", version: 2,
            meta: {id: world.id, name: world.name, seed: world.seed},
            records: {
                settings: world.settings, player: world.player ? withoutIds(world.player as unknown as Record<string, unknown>) : null,
                dimensions: world.dimensions.map((item) => withoutIds(item as unknown as Record<string, unknown>)),
                chunks: world.chunks.map((item) => withoutIds(item as unknown as Record<string, unknown>)),
                entities: world.entities.map((item) => withoutIds(item as unknown as Record<string, unknown>)),
                exploredColumns: world.exploredColumns.map((item) => withoutIds(item as unknown as Record<string, unknown>)),
                discoveredBiomes: world.discoveredBiomes.map((item) => withoutIds(item as unknown as Record<string, unknown>)),
                discoveredStructures: world.discoveredStructures.map((item) => withoutIds(item as unknown as Record<string, unknown>)),
                markers: world.markers.map((item) => withoutIds(item as unknown as Record<string, unknown>)),
                enabledPacks: world.enabledPacks.map(({namespace}) => namespace),
            },
        };
    }

    async duplicate(worldId: string, requestedId?: string) {
        const archive = await this.export(worldId);
        return this.import({...archive, newId: requestedId, meta: {...archive.meta, name: `${archive.meta.name} (Copy)`}} as ImportWorldInput);
    }

    async import(input: ImportWorldInput) {
        const worldId = input.newId ?? `world-${Date.now()}-${randomUUID().slice(0, 8)}`;
        const records = input.records as Record<string, unknown> | undefined;
        const legacy = input.document as Record<string, unknown> | undefined;
        const dimension = typeof legacy?.dimension === "string" ? legacy.dimension : "overworld";
        const legacySources: Array<{dimension: string; source: Record<string, unknown>}> = legacy ? [{dimension, source: legacy}] : [];
        if (Array.isArray(legacy?.dimensionSnapshots)) for (const entry of legacy.dimensionSnapshots) {
            if (Array.isArray(entry) && typeof entry[0] === "string" && entry[1] && typeof entry[1] === "object") legacySources.push({dimension: entry[0], source: entry[1] as Record<string, unknown>});
        }
        const legacyEntries = (source: Record<string, unknown>, name: string, key: string) => Array.isArray(source[name])
            ? (source[name] as unknown[]).filter((entry) => Array.isArray(entry) && positionChunk(entry[0])?.join(",") === key)
            : [];
        const chunks = records && Array.isArray(records.chunks) ? records.chunks : legacySources.flatMap(({dimension: sourceDimension, source}) => (Array.isArray(source.chunks) ? source.chunks : []).map((snapshot) => {
            const key = Array.isArray(snapshot) ? String(snapshot[0]) : "";
            const coordinates = key.split(",").map(Number);
            return {dimension: sourceDimension, chunkX: coordinates[0], chunkY: coordinates[1], chunkZ: coordinates[2], revision: 1, data: {
                snapshot,
                fluidLevels: legacyEntries(source, "fluidLevels", key),
                blockEntities: legacyEntries(source, "blockEntities", key),
                blockStates: legacyEntries(source, "blockStates", key),
                scheduledUpdates: Array.isArray(source.scheduledUpdates) ? source.scheduledUpdates.filter((entry) => positionChunk((entry as {position?: unknown}).position)?.join(",") === key) : [],
            }};
        })).filter((item) => [item.chunkX, item.chunkY, item.chunkZ].every(Number.isFinite));
        const legacyDocument = legacy ? {
            ...legacy, chunks: [], fluidLevels: [], blockEntities: [], blockStates: [], scheduledUpdates: [], entities: [], generatedColumns: [], spawnedCreatureGroups: [],
            dimensionSnapshots: Array.isArray(legacy.dimensionSnapshots) ? legacy.dimensionSnapshots.map((entry) => Array.isArray(entry) ? [entry[0], {...(entry[1] as Record<string, unknown>), chunks: [], fluidLevels: [], blockEntities: [], blockStates: [], scheduledUpdates: [], entities: [], generatedColumns: [], spawnedCreatureGroups: []}] : entry) : [],
        } : null;
        const settings = records?.settings ?? (legacyDocument ? {document: legacyDocument} : {});
        try {
            return await this.database.$transaction(async (tx) => {
                const world = await tx.world.create({data: {id: worldId, name: input.meta.name, seed: input.meta.seed, incarnationId: randomUUID(), settings: json(settings)}});
                const player = records?.player as Record<string, unknown> | null | undefined;
                const playerPosition = player?.position ?? legacy?.playerPosition;
                if (Array.isArray(playerPosition)) await tx.playerState.create({data: {worldId, position: json(playerPosition), positionVersion: Number(player?.positionVersion ?? 0), state: json(player?.state ?? {})}});
                for (const item of chunks as Array<Record<string, unknown>>) await tx.chunkState.create({data: {worldId, dimension: String(item.dimension), chunkX: Number(item.chunkX), chunkY: Number(item.chunkY), chunkZ: Number(item.chunkZ), revision: Number(item.revision ?? 1), data: json(item.data)}});
                const entities = records && Array.isArray(records.entities) ? records.entities : legacySources.flatMap(({dimension: sourceDimension, source}) => Array.isArray(source.entities) ? source.entities.map((state) => ({entityId: (state as {id: string}).id, dimension: sourceDimension, chunkX: Math.floor(Number((state as {position: number[]}).position?.[0] ?? 0) / 16), chunkZ: Math.floor(Number((state as {position: number[]}).position?.[2] ?? 0) / 16), generated: !(state as {id: string}).id?.includes(":placed:"), deleted: false, state})) : []);
                for (const item of entities as Array<Record<string, unknown>>) await tx.entityState.create({data: {worldId, entityId: String(item.entityId), dimension: String(item.dimension), chunkX: Number(item.chunkX), chunkZ: Number(item.chunkZ), generated: Boolean(item.generated), deleted: Boolean(item.deleted), state: nullableJson(item.state)}});
                for (const item of (Array.isArray(records?.dimensions) ? records.dimensions : []) as Array<Record<string, unknown>>) await tx.dimensionState.create({data: {worldId, dimension: String(item.dimension), state: json(item.state)}});
                const explored = (Array.isArray(records?.exploredColumns) ? records.exploredColumns : Array.isArray(legacy?.exploredColumns) ? legacy.exploredColumns.map((value) => {
                    const [savedDimension, coordinates] = String(value).split(":");
                    const [chunkX, chunkZ] = String(coordinates).split(",").map(Number);
                    return {dimension: savedDimension, chunkX, chunkZ};
                }).filter((item) => Number.isFinite(item.chunkX) && Number.isFinite(item.chunkZ)) : []) as Array<Record<string, unknown>>;
                if (explored.length) await tx.exploredColumn.createMany({data: explored.map((item) => ({worldId, dimension: String(item.dimension), chunkX: Number(item.chunkX), chunkZ: Number(item.chunkZ)}))});
                const biomes = (Array.isArray(records?.discoveredBiomes) ? records.discoveredBiomes : Array.isArray(legacy?.discoveredBiomes) ? legacy.discoveredBiomes.map((value) => {
                    const text = String(value); const separator = text.indexOf(":");
                    return {dimension: text.slice(0, separator), biomeId: text.slice(separator + 1)};
                }) : []) as Array<Record<string, unknown>>;
                if (biomes.length) await tx.discoveredBiome.createMany({data: biomes.map((item) => ({worldId, dimension: String(item.dimension), biomeId: String(item.biomeId)}))});
                const structures = (Array.isArray(records?.discoveredStructures) ? records.discoveredStructures : Array.isArray(legacy?.discoveredStructures) ? legacy.discoveredStructures.map((data) => ({structureId: String((data as {id?: unknown}).id), dimension: String((data as {dimension?: unknown}).dimension ?? dimension), data})) : []) as Array<Record<string, unknown>>;
                for (const item of structures) await tx.discoveredStructure.create({data: {worldId, structureId: String(item.structureId), dimension: String(item.dimension), data: json(item.data)}});
                const markers = (Array.isArray(records?.markers) ? records.markers : Array.isArray(legacy?.markers) ? legacy.markers : []) as Array<Record<string, unknown>>;
                for (const item of markers) await tx.worldMarker.create({data: {worldId, id: String(item.id), dimension: String(item.dimension), name: String(item.name), color: String(item.color), position: json(item.position)}});
                const enabledPacks = (Array.isArray(records?.enabledPacks) ? records.enabledPacks : []).filter((value): value is string => typeof value === "string");
                const availablePacks = enabledPacks.length ? await tx.dataPack.findMany({where: {namespace: {in: enabledPacks}}, select: {namespace: true}}) : [];
                if (availablePacks.length) await tx.worldDataPack.createMany({data: availablePacks.map(({namespace}) => ({worldId, namespace}))});
                return publicWorld(world);
            });
        } catch (error: unknown) {
            if ((error as {code?: string}).code === "P2002") throw new HttpError(409, "WORLD_EXISTS", "A world with this ID already exists");
            throw error;
        }
    }

    async region(worldId: string, query: RegionQuery) {
        const range = {gte: query.minX, lte: query.maxX};
        const zRange = {gte: query.minZ, lte: query.maxZ};
        const [chunks, entities] = await Promise.all([
            this.database.chunkState.findMany({where: {worldId, dimension: query.dimension, chunkX: range, chunkZ: zRange}}),
            this.database.entityState.findMany({where: {worldId, dimension: query.dimension, chunkX: range, chunkZ: zRange}}),
        ]);
        return {
            chunks: chunks.map(({chunkX, chunkY, chunkZ, revision, data}) => ({chunkX, chunkY, chunkZ, revision, data})),
            entities: entities.map(({entityId, chunkX, chunkZ, generated, deleted, state}) => ({entityId, chunkX, chunkZ, generated, deleted, state})),
        };
    }

    async autosave(worldId: string, input: AutosaveInput) {
        return this.database.$transaction(async (tx) => {
            const world = await tx.world.findUnique({where: {id: worldId}});
            if (!world) throw new HttpError(404, "WORLD_NOT_FOUND", "World not found");
            if (world.incarnationId !== input.incarnationId) throw new HttpError(409, "WORLD_RESET", "This world was reset while the save was in progress");
            if (world.lastBatchId === input.batchId) return {saved: true, duplicate: true, revision: world.revision};
            if (world.revision !== input.expectedRevision) throw new HttpError(409, "REVISION_CONFLICT", "A newer world revision already exists", {revision: world.revision});
            const claimed = await tx.world.updateMany({
                where: {id: worldId, revision: input.expectedRevision, incarnationId: input.incarnationId},
                data: {revision: {increment: 1}, lastBatchId: input.batchId, lastPlayedAt: new Date(), ...(input.settings ? {settings: json(input.settings)} : {})},
            });
            if (claimed.count !== 1) throw new HttpError(409, "REVISION_CONFLICT", "The world changed during this save");

            const existingPlayer = await tx.playerState.findUnique({where: {worldId}});
            if (!existingPlayer) {
                await tx.playerState.create({data: {worldId, position: json(input.player.position), positionVersion: input.player.positionVersion, state: json(input.player.state)}});
            } else {
                await tx.playerState.update({where: {worldId}, data: {state: json(input.player.state)}});
                await tx.playerState.updateMany({where: {worldId, positionVersion: {lt: input.player.positionVersion}}, data: {position: json(input.player.position), positionVersion: input.player.positionVersion}});
            }

            for (const item of input.dimensions) await tx.dimensionState.upsert({
                where: {worldId_dimension: {worldId, dimension: item.dimension}},
                create: {worldId, dimension: item.dimension, state: json(item.state)}, update: {state: json(item.state)},
            });
            for (const item of input.chunks) await tx.chunkState.upsert({
                where: {worldId_dimension_chunkX_chunkY_chunkZ: {worldId, dimension: item.dimension, chunkX: item.chunkX, chunkY: item.chunkY, chunkZ: item.chunkZ}},
                create: {...item, data: json(item.data), worldId}, update: {data: json(item.data), revision: item.revision},
            });
            for (const item of input.entities) await tx.entityState.upsert({
                where: {worldId_dimension_entityId: {worldId, dimension: item.dimension, entityId: item.entityId}},
                create: {...item, state: nullableJson(item.state), worldId}, update: {chunkX: item.chunkX, chunkZ: item.chunkZ, generated: item.generated, deleted: item.deleted, state: nullableJson(item.state)},
            });
            if (input.exploredColumns.length) await tx.exploredColumn.createMany({data: input.exploredColumns.map((item) => ({...item, worldId})), skipDuplicates: true});
            if (input.discoveredBiomes.length) await tx.discoveredBiome.createMany({data: input.discoveredBiomes.map((item) => ({...item, worldId})), skipDuplicates: true});
            for (const item of input.discoveredStructures) await tx.discoveredStructure.upsert({
                where: {worldId_structureId: {worldId, structureId: item.structureId}}, create: {...item, data: json(item.data), worldId}, update: {dimension: item.dimension, data: json(item.data)},
            });
            const retainedMarkerIds = input.markers.map((marker) => marker.id);
            await tx.worldMarker.deleteMany({where: {worldId, ...(retainedMarkerIds.length ? {id: {notIn: retainedMarkerIds}} : {})}});
            for (const marker of input.markers) await tx.worldMarker.upsert({
                where: {worldId_id: {worldId, id: marker.id}}, create: {...marker, position: json(marker.position), worldId}, update: {dimension: marker.dimension, name: marker.name, color: marker.color, position: json(marker.position)},
            });
            const document = (input.settings as {document?: {enabledPacks?: unknown}} | undefined)?.document;
            if (Array.isArray(document?.enabledPacks)) {
                const requested = document.enabledPacks.filter((value): value is string => typeof value === "string");
                const available = requested.length ? await tx.dataPack.findMany({where: {namespace: {in: requested}}, select: {namespace: true}}) : [];
                await tx.worldDataPack.deleteMany({where: {worldId}});
                if (available.length) await tx.worldDataPack.createMany({data: available.map(({namespace}) => ({worldId, namespace})), skipDuplicates: true});
            }
            return {saved: true, duplicate: false, revision: input.expectedRevision + 1};
        });
    }

    async savePlayer(worldId: string, input: PlayerSaveInput) {
        const world = await this.database.world.findUnique({where: {id: worldId}, select: {incarnationId: true}});
        if (!world) throw new HttpError(404, "WORLD_NOT_FOUND", "World not found");
        if (world.incarnationId !== input.incarnationId) throw new HttpError(409, "WORLD_RESET", "This world has been reset");
        const result = await this.database.playerState.updateMany({where: {worldId, positionVersion: {lt: input.positionVersion}}, data: {position: json(input.position), positionVersion: input.positionVersion}});
        return {saved: result.count === 1, positionVersion: input.positionVersion};
    }

    async reset(worldId: string, input: ResetWorldInput) {
        return this.database.$transaction(async (tx) => {
            const current = await tx.world.findUnique({where: {id: worldId}});
            if (!current) throw new HttpError(404, "WORLD_NOT_FOUND", "World not found");
            await Promise.all([
                tx.playerState.deleteMany({where: {worldId}}), tx.dimensionState.deleteMany({where: {worldId}}),
                tx.chunkState.deleteMany({where: {worldId}}), tx.entityState.deleteMany({where: {worldId}}),
                tx.exploredColumn.deleteMany({where: {worldId}}), tx.discoveredBiome.deleteMany({where: {worldId}}),
                tx.discoveredStructure.deleteMany({where: {worldId}}), tx.worldMarker.deleteMany({where: {worldId}}),
                tx.worldDataPack.deleteMany({where: {worldId}}),
            ]);
            const world = await tx.world.update({where: {id: worldId}, data: {
                seed: input.seed ?? current.seed, settings: json(input.settings), incarnationId: randomUUID(),
                revision: {increment: 1}, lastBatchId: null, lastPlayedAt: new Date(),
                player: {create: {position: json(input.player.position), positionVersion: input.player.positionVersion, state: json(input.player.state)}},
            }});
            return publicWorld(world);
        });
    }

    async remove(worldId: string) {
        const deleted = await this.database.world.deleteMany({where: {id: worldId}});
        if (!deleted.count) throw new HttpError(404, "WORLD_NOT_FOUND", "World not found");
        return {deleted: true};
    }
}
