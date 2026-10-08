import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is required");
    const max = Number(process.env.DATABASE_POOL_MAX ?? 5);
    super({ adapter: new PrismaPg({ connectionString, max: Number.isFinite(max) && max > 0 ? max : 5 }) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
