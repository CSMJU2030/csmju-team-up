import { defineConfig, env } from "prisma/config";
import { config as loadEnv } from "dotenv";

if (!process.env.DIRECT_URL && process.argv.includes("generate")) {
  loadEnv({ path: ".env.example" });
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
