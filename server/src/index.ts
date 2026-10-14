import {createServer} from "node:http";
import {createApp} from "./app.js";
import {config} from "./config.js";
import {db} from "./db.js";

const server = createServer(createApp());
server.listen(config.PORT, config.HOST, () => {
    console.log(`Minecraft API listening on http://${config.HOST}:${config.PORT}`);
});

async function shutdown(signal: string) {
    console.log(`${signal} received; closing Minecraft API`);
    server.close(async () => {
        await db.$disconnect();
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
