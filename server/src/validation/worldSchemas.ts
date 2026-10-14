import {z} from "zod";

const id = z.string().min(1).max(256);
const dimension = z.string().min(1).max(64);
const position = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);
const jsonObject = z.record(z.string(), z.unknown());

export const worldIdSchema = z.object({worldId: z.string().min(1).max(128)});

export const createWorldSchema = z.object({
    id: z.string().min(1).max(128).optional(),
    name: z.string().trim().min(1).max(120).default("My World"),
    seed: z.string().trim().min(1).max(256),
    settings: jsonObject.default({}),
    player: z.object({position, state: jsonObject, positionVersion: z.number().int().min(0).default(0)}).optional(),
});

export const resetWorldSchema = z.object({
    seed: z.string().trim().min(1).max(256).optional(),
    settings: jsonObject.default({}),
    player: z.object({position, state: jsonObject, positionVersion: z.number().int().min(0).default(0)}),
});

export const regionQuerySchema = z.object({
    dimension,
    minX: z.coerce.number().int(),
    maxX: z.coerce.number().int(),
    minZ: z.coerce.number().int(),
    maxZ: z.coerce.number().int(),
}).refine((value) => value.minX <= value.maxX && value.minZ <= value.maxZ, "Invalid region bounds")
    .refine((value) => value.maxX - value.minX <= 32 && value.maxZ - value.minZ <= 32, "Region is too large");

const chunk = z.object({
    dimension,
    chunkX: z.number().int(),
    chunkY: z.number().int(),
    chunkZ: z.number().int(),
    revision: z.number().int().min(0),
    data: jsonObject,
});

const entity = z.object({
    entityId: id,
    dimension,
    chunkX: z.number().int(),
    chunkZ: z.number().int(),
    generated: z.boolean().default(false),
    deleted: z.boolean().default(false),
    state: jsonObject.nullable(),
});

export const autosaveSchema = z.object({
    incarnationId: z.string().min(1).max(64),
    batchId: z.string().min(1).max(64),
    expectedRevision: z.number().int().min(0),
    settings: jsonObject.optional(),
    player: z.object({position, positionVersion: z.number().int().min(0), state: jsonObject}),
    dimensions: z.array(z.object({dimension, state: jsonObject})).max(8).default([]),
    chunks: z.array(chunk).max(256).default([]),
    entities: z.array(entity).max(512).default([]),
    exploredColumns: z.array(z.object({dimension, chunkX: z.number().int(), chunkZ: z.number().int()})).max(1024).default([]),
    discoveredBiomes: z.array(z.object({dimension, biomeId: id})).max(256).default([]),
    discoveredStructures: z.array(z.object({structureId: id, dimension, data: jsonObject})).max(256).default([]),
    markers: z.array(z.object({id, dimension, name: z.string().trim().min(1).max(120), color: z.string().max(16), position})).max(512).default([]),
    deletedMarkerIds: z.array(id).max(512).default([]),
});

export const playerSaveSchema = z.object({
    incarnationId: z.string().min(1).max(64),
    position,
    positionVersion: z.number().int().min(0),
});

export const importWorldSchema = z.object({
    format: z.enum(["minecraft-react-export", "minecraft-react-database-export"]),
    version: z.number().int().min(1).max(2),
    meta: z.object({
        id: z.string().min(1).max(128).optional(),
        name: z.string().trim().min(1).max(120),
        seed: z.string().min(1).max(256),
    }),
    document: jsonObject.optional(),
    records: jsonObject.optional(),
    newId: z.string().min(1).max(128).optional(),
}).refine((value) => value.document || value.records, "Export contains no world data");

export const dataPackSchema = z.object({
    version: z.literal(1),
    namespace: z.string().regex(/^[a-z][a-z0-9_]{1,23}$/),
    blocks: z.array(z.object({
        id: z.string().regex(/^[a-z][a-z0-9_]{1,23}$/),
        name: z.string().trim().min(1).max(80),
        color: z.string().regex(/^#[0-9a-f]{6}$/i),
        accent: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
        hardness: z.number().min(50).max(3000).optional(),
        solid: z.boolean().optional(),
    })).max(32),
    recipes: z.array(z.unknown()).max(64).optional(),
});

export type CreateWorldInput = z.infer<typeof createWorldSchema>;
export type ResetWorldInput = z.infer<typeof resetWorldSchema>;
export type AutosaveInput = z.infer<typeof autosaveSchema>;
export type PlayerSaveInput = z.infer<typeof playerSaveSchema>;
export type ImportWorldInput = z.infer<typeof importWorldSchema>;
export type RegionQuery = z.infer<typeof regionQuerySchema>;
