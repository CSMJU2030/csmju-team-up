import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service.js";
import type { CoreIdentity } from "../auth/decorators/current-user.js";

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async get(user: CoreIdentity) {
    return this.prisma.collaborationProfile.findUnique({
      where: { coreUserId: user.coreUserId },
      include: { portfolio: true },
    });
  }

  async upsert(user: CoreIdentity, input: { skills: string[]; githubUrl?: string; linkedinUrl?: string; contactText?: string; isAvailable: boolean }) {
    return this.prisma.collaborationProfile.upsert({
      where: { coreUserId: user.coreUserId },
      create: { coreUserId: user.coreUserId, ...input },
      update: { ...input },
      include: { portfolio: true },
    });
  }

  async addPortfolio(user: CoreIdentity, input: { imageId: string; caption?: string }) {
    return this.prisma.portfolioItem.create({
      data: { coreUserId: user.coreUserId, imageId: input.imageId, caption: input.caption },
    });
  }

  async deletePortfolio(user: CoreIdentity, id: string) {
    const item = await this.prisma.portfolioItem.findUnique({ where: { id } });
    if (!item || item.coreUserId !== user.coreUserId) throw new NotFoundException("Portfolio item not found");
    await this.prisma.portfolioItem.delete({ where: { id } });
    return { id, deleted: true };
  }
}
