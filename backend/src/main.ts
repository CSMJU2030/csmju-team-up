import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { EnvelopeInterceptor } from "./common/envelope.interceptor.js";
import { HttpExceptionFilter } from "./common/http-exception.filter.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:3220", credentials: true });
  app.setGlobalPrefix("api", {
    exclude: ["auth/login", "auth/callback", "auth/logout"],
  });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
    transformOptions: { enableImplicitConversion: true },
  }));
  app.useGlobalInterceptors(new EnvelopeInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(Number(process.env.PORT ?? 4220), "0.0.0.0");
}

void bootstrap();
