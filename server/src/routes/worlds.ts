import {Router} from "express";
import type {Database} from "../db.js";
import {WorldService} from "../services/worldService.js";
import {autosaveSchema, createWorldSchema, importWorldSchema, playerSaveSchema, regionQuerySchema, resetWorldSchema, worldIdSchema} from "../validation/worldSchemas.js";

export function worldRoutes(database: Database) {
    const router = Router();
    const worlds = new WorldService(database);

    router.get("/", async (_request, response) => response.json({worlds: await worlds.list()}));
    router.post("/", async (request, response) => response.status(201).json(await worlds.create(createWorldSchema.parse(request.body))));
    router.post("/import", async (request, response) => response.status(201).json(await worlds.import(importWorldSchema.parse(request.body))));
    router.get("/:worldId", async (request, response) => {
        const {worldId} = worldIdSchema.parse(request.params);
        response.json(await worlds.bootstrap(worldId));
    });
    router.get("/:worldId/regions", async (request, response) => {
        const {worldId} = worldIdSchema.parse(request.params);
        response.json(await worlds.region(worldId, regionQuerySchema.parse(request.query)));
    });
    router.get("/:worldId/export", async (request, response) => {
        const {worldId} = worldIdSchema.parse(request.params);
        response.json(await worlds.export(worldId));
    });
    router.post("/:worldId/duplicate", async (request, response) => {
        const {worldId} = worldIdSchema.parse(request.params);
        response.status(201).json(await worlds.duplicate(worldId, typeof request.body?.id === "string" ? request.body.id : undefined));
    });
    router.patch("/:worldId/autosave", async (request, response) => {
        const {worldId} = worldIdSchema.parse(request.params);
        response.json(await worlds.autosave(worldId, autosaveSchema.parse(request.body)));
    });
    router.patch("/:worldId/player", async (request, response) => {
        const {worldId} = worldIdSchema.parse(request.params);
        response.json(await worlds.savePlayer(worldId, playerSaveSchema.parse(request.body)));
    });
    router.post("/:worldId/reset", async (request, response) => {
        const {worldId} = worldIdSchema.parse(request.params);
        response.json(await worlds.reset(worldId, resetWorldSchema.parse(request.body)));
    });
    router.delete("/:worldId", async (request, response) => {
        const {worldId} = worldIdSchema.parse(request.params);
        response.json(await worlds.remove(worldId));
    });
    return router;
}
