import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service.js";
import type { CoreIdentity } from "../auth/decorators/current-user.js";

export type WorkSize = "SMALL" | "MEDIUM" | "LARGE";
export type EvidenceKind = "REPOSITORY" | "DEMO" | "DOCUMENT" | "OTHER";
export type ContributionVisibility = "PRIVATE" | "TEAM" | "PUBLIC";

const DEFAULT_POINT_VALUES: Record<WorkSize, number> = { SMALL: 5, MEDIUM: 10, LARGE: 20 };
const POINT_ENV_KEYS: Record<WorkSize, string> = {
  SMALL: "CONTRIBUTION_POINTS_SMALL",
  MEDIUM: "CONTRIBUTION_POINTS_MEDIUM",
  LARGE: "CONTRIBUTION_POINTS_LARGE",
};

/** Values are centrally configured and may be overridden per deployment. */
export function contributionPointsFor(size: WorkSize, env: Record<string, string | undefined> = process.env): number {
  const raw = env[POINT_ENV_KEYS[size]];
  if (raw === undefined || raw.trim() === "") return DEFAULT_POINT_VALUES[size];
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0 || value > 1000) {
    throw new Error(`${POINT_ENV_KEYS[size]} must be an integer from 0 to 1000`);
  }
  return value;
}

@Injectable()
export class ContributionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(user: CoreIdentity) {
    const where = { coreUserId: user.coreUserId };
    const [works, ledger, total] = await Promise.all([
      this.prisma.contributionWork.findMany({
        where: { coreUserId: user.coreUserId },
        include: { evidence: true, project: { select: { id: true, title: true, status: true } }, pointTransactions: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      this.prisma.contributionPointTransaction.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 }),
      this.prisma.contributionPointTransaction.aggregate({ where, _sum: { points: true } }),
    ]);
    return { works, points: total._sum.points ?? 0, ledger };
  }


  async listReviewQueue(user: CoreIdentity) {
    const rows = await this.prisma.contributionWork.findMany({
      where: { status: "SUBMITTED", coreUserId: { not: user.coreUserId } },
      include: {
        evidence: true,
        project: { select: { id: true, title: true, status: true, coreUserId: true, members: { select: { coreUserId: true } } } },
      },
      orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
      take: 200,
    });
    const privilegedReviewer = ["ADMIN", "STAFF"].includes(user.subsystemRole);
    return rows.filter((work) => {
      if (!work.project) return privilegedReviewer;
      return work.project.coreUserId === user.coreUserId || work.project.members.some((member) => member.coreUserId === user.coreUserId);
    }).map((work) => ({
      ...work,
      project: work.project ? { id: work.project.id, title: work.project.title, status: work.project.status } : null,
    }));
  }

  async create(user: CoreIdentity, input: {
    projectId?: string; title: string; description: string; role: string; skills?: string[];
    workSize: WorkSize; repositoryUrl?: string; demoUrl?: string; visibility?: ContributionVisibility;
  }) {
    const title = input.title.trim();
    if (!title || !input.description.trim() || !input.role.trim()) throw new BadRequestException("กรุณากรอกชื่อผลงาน รายละเอียด และบทบาท");
    if (input.projectId) await this.assertParticipant(user, input.projectId);
    await this.prisma.collaborationProfile.upsert({
      where: { coreUserId: user.coreUserId },
      create: { coreUserId: user.coreUserId, skills: input.skills ?? [], isAvailable: true },
      update: {},
      select: { id: true },
    });
    return this.prisma.contributionWork.create({
      data: {
        coreUserId: user.coreUserId,
        projectId: input.projectId,
        title,
        description: input.description.trim(),
        role: input.role.trim(),
        skills: this.clean(input.skills ?? []),
        workSize: input.workSize,
        repositoryUrl: input.repositoryUrl?.trim() || null,
        demoUrl: input.demoUrl?.trim() || null,
        visibility: input.visibility ?? "PRIVATE",
      },
      include: { evidence: true, project: { select: { id: true, title: true } } },
    });
  }

  async addEvidence(user: CoreIdentity, contributionId: string, input: { evidenceType: EvidenceKind; url: string; caption?: string }) {
    const work = await this.prisma.contributionWork.findUnique({ where: { id: contributionId } });
    if (!work || work.coreUserId !== user.coreUserId) throw new NotFoundException("ไม่พบผลงานของคุณ");
    if (work.status !== "DRAFT" && work.status !== "REJECTED") throw new ConflictException("เพิ่มหลักฐานได้ก่อนส่งตรวจเท่านั้น");
    return this.prisma.contributionEvidence.create({
      data: { contributionId, evidenceType: input.evidenceType, url: input.url.trim(), caption: input.caption?.trim() || null, createdByCoreUserId: user.coreUserId },
    });
  }

  async submit(user: CoreIdentity, contributionId: string) {
    const work = await this.prisma.contributionWork.findUnique({ where: { id: contributionId }, include: { evidence: true } });
    if (!work || work.coreUserId !== user.coreUserId) throw new NotFoundException("ไม่พบผลงานของคุณ");
    if (work.status !== "DRAFT" && work.status !== "REJECTED") throw new ConflictException("ผลงานนี้ถูกส่งตรวจไปแล้วหรือยืนยันแล้ว");
    if (!work.evidence.length && !work.repositoryUrl && !work.demoUrl) throw new BadRequestException("ต้องแนบหลักฐานอย่างน้อย 1 รายการ หรือใส่ GitHub/Demo URL");
    return this.prisma.contributionWork.update({
      where: { id: contributionId },
      data: { status: "SUBMITTED", submittedAt: new Date(), reviewNote: null, verifiedByCoreUserId: null, verifiedAt: null },
      include: { evidence: true, project: { select: { id: true, title: true } } },
    });
  }

  async review(user: CoreIdentity, contributionId: string, input: { decision: "APPROVE" | "REJECT"; reviewNote?: string }) {
    const work = await this.prisma.contributionWork.findUnique({ where: { id: contributionId }, include: { project: { include: { members: true } } } });
    if (!work) throw new NotFoundException("ไม่พบผลงาน");
    if (work.coreUserId === user.coreUserId) throw new ForbiddenException("ไม่สามารถอนุมัติผลงานของตัวเองได้");
    if (work.status !== "SUBMITTED") throw new ConflictException("ผลงานต้องอยู่ในสถานะรอตรวจ");

    if (work.project) {
      const isReviewer = work.project.coreUserId === user.coreUserId || work.project.members.some((member) => member.coreUserId === user.coreUserId);
      if (!isReviewer) throw new ForbiddenException("ต้องเป็นเจ้าของหรือสมาชิกโปรเจกต์จึงตรวจผลงานนี้ได้");
    } else if (!["ADMIN", "STAFF", "LECTURER"].includes(user.subsystemRole)) {
      throw new ForbiddenException("ผลงานส่วนตัวต้องได้รับการตรวจจากผู้ดูแล อาจารย์ หรือบุคลากร");
    }

    const approved = input.decision === "APPROVE";
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.contributionWork.updateMany({
        where: { id: contributionId, status: "SUBMITTED" },
        data: {
          status: approved ? "VERIFIED" : "REJECTED",
          reviewNote: input.reviewNote?.trim() || (approved ? null : "กรุณาแก้ไขหลักฐานและส่งตรวจใหม่"),
          verifiedByCoreUserId: approved ? user.coreUserId : null,
          verifiedAt: approved ? new Date() : null,
        },
      });
      if (updated.count !== 1) throw new ConflictException("ผลงานนี้ถูกตรวจโดยผู้ใช้อื่นแล้ว");
      if (approved) {
        const points = contributionPointsFor(work.workSize);
        if (points > 0) {
          await tx.contributionPointTransaction.create({
            data: {
              coreUserId: work.coreUserId,
              contributionId: work.id,
              points,
              transactionType: "AWARD",
              reason: `ยืนยันผลงาน: ${work.title}`,
              eventKey: `contribution-award:${work.id}`,
              createdByCoreUserId: user.coreUserId,
            },
          });
        }
      }
      return tx.contributionWork.findUnique({ where: { id: work.id }, include: { evidence: true, pointTransactions: true } });
    });
    return result;
  }

  async points(user: CoreIdentity) {
    const where = { coreUserId: user.coreUserId };
    const [ledger, total] = await Promise.all([
      this.prisma.contributionPointTransaction.findMany({
        where, orderBy: { createdAt: "desc" }, take: 100,
        include: { contribution: { select: { id: true, title: true, status: true } } },
      }),
      this.prisma.contributionPointTransaction.aggregate({ where, _sum: { points: true } }),
    ]);
    return { balance: total._sum.points ?? 0, transactions: ledger };
  }

  private async assertParticipant(user: CoreIdentity, projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, include: { members: true } });
    if (!project) throw new NotFoundException("ไม่พบโปรเจกต์");
    if (project.coreUserId !== user.coreUserId && !project.members.some((member) => member.coreUserId === user.coreUserId)) {
      throw new ForbiddenException("ต้องเป็นสมาชิกโปรเจกต์ก่อนบันทึก contribution ที่ผูกกับโปรเจกต์");
    }
  }

  private clean(values: string[]) { return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, 30); }
}
