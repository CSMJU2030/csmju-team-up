import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { config as loadEnv } from "dotenv";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

async function generate(): Promise<void> {
  loadEnv({ path: resolve(process.cwd(), ".env.example") });
  const { AppModule } = await import("./app.module.js");
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  const subsystem = process.env.SUBSYSTEM_ID ?? "csmju-teamup";
  const documentConfig = new DocumentBuilder()
    .setTitle("CS TeamUp API")
    .setDescription("CSMJU2030 Project Collaborator Finder API")
    .setVersion("1.0.0")
    .addCookieAuth(`${subsystem.replaceAll("-", "_")}_access_token`)
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" })
    .build();
  const document = SwaggerModule.createDocument(app, documentConfig);
  await writeFile(resolve(process.cwd(), "../openapi.json"), JSON.stringify(document, null, 2) + "\n", "utf8");
  await app.close();
}

void generate().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
