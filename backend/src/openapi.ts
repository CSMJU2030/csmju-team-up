import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { AppModule } from "./app.module.js";

async function generate(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  const subsystem = process.env.SUBSYSTEM_ID ?? "csmju-teamup";
  const documentConfig = new DocumentBuilder()
    .setTitle("CS TeamUp API")
    .setDescription("CSMJU2030 Project Collaborator Finder API")
    .setVersion("1.0.0")
    .addCookieAuth(`${subsystem.replaceAll("-", "_")}_access_token`)
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" })
    .build();
  const document = SwaggerModule.createDocument(app, documentConfig);
  await writeFile(fileURLToPath(new URL("../../openapi.json", import.meta.url)), JSON.stringify(document, null, 2) + "\n", "utf8");
  await app.close();
}

void generate();
