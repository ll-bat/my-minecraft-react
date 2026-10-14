import {Router} from "express";
import {Prisma} from "../../generated/prisma/client.js";
import type {Database} from "../db.js";
import {dataPackSchema} from "../validation/worldSchemas.js";

export function dataPackRoutes(database: Database) {
    const router = Router();
    router.get("/", async (_request, response) => {
        const packs = await database.dataPack.findMany({orderBy: {namespace: "asc"}});
        response.json({packs: packs.map((pack) => pack.source)});
    });
    router.put("/:namespace", async (request, response) => {
        const source = dataPackSchema.parse({...request.body, namespace: request.params.namespace});
        const json = source as Prisma.InputJsonValue;
        await database.dataPack.upsert({where: {namespace: source.namespace}, create: {namespace: source.namespace, source: json}, update: {source: json}});
        response.json({saved: true, pack: source});
    });
    return router;
}
