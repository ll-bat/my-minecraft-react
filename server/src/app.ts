import {randomUUID} from "node:crypto";
import express, {type ErrorRequestHandler} from "express";
import path from "node:path";
import {ZodError} from "zod";
import type {Database} from "./db.js";
import {db} from "./db.js";
import {HttpError} from "./errors.js";
import {dataPackRoutes} from "./routes/dataPacks.js";
import {worldRoutes} from "./routes/worlds.js";
import {config} from "./config.js";

export function createApp(database: Database = db) {
    const app = express();
    app.disable("x-powered-by");
    app.use((request, response, next) => {
        response.setHeader("X-Request-Id", request.header("X-Request-Id") ?? randomUUID());
        next();
    });
    // Legacy browser worlds can approach the localStorage quota during their
    // one-time transactional import. Normal autosaves remain bounded by Zod.
    app.use(express.json({limit: "12mb"}));
    app.get("/api/health", async (_request, response) => {
        await database.world.count();
        response.json({ok: true, database: "reachable"});
    });
    app.use("/api/worlds", worldRoutes(database));
    app.use("/api/data-packs", dataPackRoutes(database));
    if (config.NODE_ENV === "production") {
        const clientBuild = path.resolve(process.cwd(), path.basename(process.cwd()) === "server" ? "../build" : "build");
        app.use(express.static(clientBuild));
        app.get(/^(?!\/api(?:\/|$)).*/, (_request, response) => response.sendFile(path.join(clientBuild, "index.html")));
    }
    app.use((_request, response) => response.status(404).json({error: {code: "NOT_FOUND", message: "Route not found"}}));

    const errors: ErrorRequestHandler = (error, _request, response, _next) => {
        if (error instanceof ZodError) {
            response.status(400).json({error: {code: "VALIDATION_ERROR", message: "Request validation failed", details: error.issues}});
            return;
        }
        if (error instanceof HttpError) {
            response.status(error.status).json({error: {code: error.code, message: error.message, details: error.details}});
            return;
        }
        console.error(error);
        response.status(500).json({error: {code: "INTERNAL_ERROR", message: "The server could not complete the request"}});
    };
    app.use(errors);
    return app;
}
