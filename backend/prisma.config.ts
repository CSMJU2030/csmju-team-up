import { defineConfig, env } from "prisma/config";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";

if (!process.env.DIRECT_URL && process.argv.includes("generate")) {
  loadEnv({ path: fileURLToPath(new URL("./.env.example", import.meta.url)) });
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
