import "dotenv/config";
import {z} from "zod";

const configSchema = z.object({
    DATABASE_URL: z.string().min(1).default("postgresql://minecraft:minecraft@127.0.0.1:5432/minecraft"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    HOST: z.string().min(1).default("127.0.0.1"),
    CLIENT_ORIGIN: z.string().url().default("http://localhost:3000"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const config = configSchema.parse(process.env);
