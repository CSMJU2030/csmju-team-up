import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service.js";
import type { CoreIdentity } from "../auth/decorators/current-user.js";

@Injectable()
export class RewardsService {
  constructor(private readonly prisma: PrismaService) {}

  catalog() {
    return this.prisma.rewardCatalog.findMany({
      where: { status: "ACTIVE", OR: [{ remainingQuantity: null }, { remainingQuantity: { gt: 0 } }] },
      orderBy: [{ category: "asc" }, { pointCost: "asc" }, { name: "asc" }],
    });
  }

  manageCatalog() {
    return this.prisma.rewardCatalog.findMany({
      orderBy: [{ status: "asc" }, { category: "asc" }, { pointCost: "asc" }, { name: "asc" }],
    });
  }

  createDraft(user: CoreIdentity, input: { name: string; description: string; category: string; pointCost: number; quantity?: number | null }) {
    const name = input.name.trim();
    const description = input.description.trim();
    const category = input.category.trim();
    if (!name || !description || !category) throw new BadRequestException("กรุณากรอกชื่อ รายละเอียด และหมวดหมู่รางวัล");
    return this.prisma.rewardCatalog.create({
      data: {
        name, description, category,
        pointCost: input.pointCost, remainingQuantity: input.quantity ?? null, createdByCoreUserId: user.coreUserId,
      },
    });
  }

  async activate(user: CoreIdentity, rewardId: string) {
    const result = await this.prisma.rewardCatalog.updateMany({
      where: { id: rewardId, status: "DRAFT" },
      data: { status: "ACTIVE", activatedByCoreUserId: user.coreUserId, activatedAt: new Date() },
    });
    if (result.count !== 1) {
      const reward = await this.prisma.rewardCatalog.findUnique({ where: { id: rewardId }, select: { id: true } });
      if (!reward) throw new NotFoundException("ไม่พบรางวัล");
      throw new ConflictException("เปิดใช้งานได้เฉพาะรางวัลฉบับร่าง");
    }
    return this.prisma.rewardCatalog.findUniqueOrThrow({ where: { id: rewardId } });
  }

  async redemptions(user: CoreIdentity) {
    const [redemptions, total] = await Promise.all([
      this.prisma.rewardRedemption.findMany({
        where: { coreUserId: user.coreUserId },
        include: { reward: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      this.prisma.contributionPointTransaction.aggregate({
        where: { coreUserId: user.coreUserId },
        _sum: { points: true },
      }),
    ]);
    return { redemptions, points: total._sum.points ?? 0 };
  }

  pendingRedemptions() {
    return this.prisma.rewardRedemption.findMany({
      where: { status: "REQUESTED" },
      include: { reward: true },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
  }

  async redeem(user: CoreIdentity, rewardId: string, input: { requestNote?: string }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.collaborationProfile.upsert({
        where: { coreUserId: user.coreUserId },
        create: { coreUserId: user.coreUserId, skills: [], isAvailable: true },
        update: {},
        select: { id: true },
      });
      await tx.$queryRaw`SELECT id FROM "collaboration_profiles" WHERE core_user_id = ${user.coreUserId} FOR UPDATE`;

      const reward = await tx.rewardCatalog.findUnique({ where: { id: rewardId } });
      if (!reward || reward.status !== "ACTIVE") throw new NotFoundException("ไม่พบรางวัลที่เปิดแลก");
      if (reward.remainingQuantity !== null && reward.remainingQuantity <= 0) throw new ConflictException("รางวัลนี้หมดแล้ว");
      const balance = await tx.contributionPointTransaction.aggregate({
        where: { coreUserId: user.coreUserId },
        _sum: { points: true },
      });
      if ((balance._sum.points ?? 0) < reward.pointCost) throw new ConflictException("แต้มของคุณไม่เพียงพอสำหรับแลกรางวัลนี้");

      if (reward.remainingQuantity !== null) {
        const stock = await tx.rewardCatalog.updateMany({
          where: { id: rewardId, status: "ACTIVE", remainingQuantity: { gt: 0 } },
          data: { remainingQuantity: { decrement: 1 } },
        });
        if (stock.count !== 1) throw new ConflictException("รางวัลนี้หมดแล้ว");
      }

      const redemption = await tx.rewardRedemption.create({
        data: {
          rewardId,
          coreUserId: user.coreUserId,
          pointCost: reward.pointCost,
          requestNote: input.requestNote?.trim() || null,
        },
        include: { reward: true },
      });
      await tx.contributionPointTransaction.create({
        data: {
          coreUserId: user.coreUserId,
          redemptionId: redemption.id,
          points: -reward.pointCost,
          transactionType: "REDEMPTION",
          reason: `แลกรางวัล: ${reward.name}`,
          eventKey: `reward-redemption:${redemption.id}`,
          createdByCoreUserId: user.coreUserId,
        },
      });
      return redemption;
    }, { isolationLevel: "Serializable" });
  }

  async cancel(user: CoreIdentity, redemptionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const redemption = await tx.rewardRedemption.findUnique({
        where: { id: redemptionId },
        include: { reward: true },
      });
      if (!redemption) throw new NotFoundException("ไม่พบคำขอแลกรางวัล");
      if (redemption.coreUserId !== user.coreUserId) throw new ForbiddenException("ยกเลิกได้เฉพาะคำขอของคุณ");
      if (redemption.status !== "REQUESTED") throw new ConflictException("ยกเลิกได้เฉพาะรายการที่ยังรออนุมัติ");

      const updated = await tx.rewardRedemption.updateMany({
        where: { id: redemptionId, coreUserId: user.coreUserId, status: "REQUESTED" },
        data: { status: "CANCELLED" },
      });
      if (updated.count !== 1) throw new ConflictException("คำขอนี้ถูกเปลี่ยนสถานะแล้ว กรุณาโหลดข้อมูลใหม่");
      await tx.contributionPointTransaction.create({
        data: {
          coreUserId: user.coreUserId,
          points: redemption.pointCost,
          transactionType: "REFUND",
          reason: `คืนแต้มจากการยกเลิก: ${redemption.reward.name}`,
          eventKey: `reward-refund:${redemption.id}`,
          createdByCoreUserId: user.coreUserId,
        },
      });
      if (redemption.reward.remainingQuantity !== null) {
        await tx.rewardCatalog.update({
          where: { id: redemption.rewardId },
          data: { remainingQuantity: { increment: 1 } },
        });
      }
      return tx.rewardRedemption.findUniqueOrThrow({ where: { id: redemptionId }, include: { reward: true } });
    });
  }

  async review(user: CoreIdentity, redemptionId: string, approved: boolean, reviewNote?: string) {
    return this.prisma.$transaction(async (tx) => {
      const redemption = await tx.rewardRedemption.findUnique({ where: { id: redemptionId }, include: { reward: true } });
      if (!redemption) throw new NotFoundException("ไม่พบคำขอแลกรางวัล");
      if (redemption.coreUserId === user.coreUserId) throw new ForbiddenException("ไม่สามารถตรวจคำขอของตัวเองได้");
      if (redemption.status !== "REQUESTED") throw new ConflictException("คำขอนี้ถูกตรวจไปแล้วหรือยกเลิกแล้ว");

      const updated = await tx.rewardRedemption.updateMany({
        where: { id: redemptionId, status: "REQUESTED" },
        data: {
          status: approved ? "APPROVED" : "REJECTED",
          reviewNote: reviewNote?.trim() || null,
          reviewedByCoreUserId: user.coreUserId,
          reviewedAt: new Date(),
        },
      });
      if (updated.count !== 1) throw new ConflictException("คำขอนี้ถูกตรวจโดยผู้ใช้อื่นแล้ว");

      if (!approved) {
        await tx.contributionPointTransaction.create({
          data: {
            coreUserId: redemption.coreUserId, points: redemption.pointCost, transactionType: "REFUND",
            reason: `คืนแต้มจากคำขอที่ไม่อนุมัติ: ${redemption.reward.name}`,
            eventKey: `reward-refund:${redemption.id}`, createdByCoreUserId: user.coreUserId,
          },
        });
        if (redemption.reward.remainingQuantity !== null) {
          await tx.rewardCatalog.update({ where: { id: redemption.rewardId }, data: { remainingQuantity: { increment: 1 } } });
        }
      }
      return tx.rewardRedemption.findUniqueOrThrow({ where: { id: redemptionId }, include: { reward: true } });
    });
  }

  async fulfill(user: CoreIdentity, redemptionId: string) {
    const updated = await this.prisma.rewardRedemption.updateMany({
      where: { id: redemptionId, status: "APPROVED" },
      data: { status: "FULFILLED", fulfilledAt: new Date(), fulfilledByCoreUserId: user.coreUserId },
    });
    if (updated.count !== 1) {
      const redemption = await this.prisma.rewardRedemption.findUnique({ where: { id: redemptionId }, select: { id: true } });
      if (!redemption) throw new NotFoundException("ไม่พบคำขอแลกรางวัล");
      throw new ConflictException("จัดส่งได้เฉพาะคำขอที่อนุมัติแล้ว");
    }
    return this.prisma.rewardRedemption.findUniqueOrThrow({ where: { id: redemptionId }, include: { reward: true } });
  }
}
