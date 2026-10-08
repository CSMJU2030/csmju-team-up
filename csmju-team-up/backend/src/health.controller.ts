import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "./common/prisma.service.js";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  async get() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { service: process.env.SUBSYSTEM_ID ?? "csmju-team-up", status: "ok", version: "0.1.0" };
    } catch {
      throw new ServiceUnavailableException("Database unavailable");
    }
  }
}
