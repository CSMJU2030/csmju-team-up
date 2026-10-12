import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service.js";
import type { CoreIdentity } from "../auth/decorators/current-user.js";

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class CommunityService {
  constructor(private readonly prisma: PrismaService) {}

  async directory(user: CoreIdentity, query: { q?: string; skill?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));
    const where = {
      isDiscoverable: true,
      visibility: "PUBLIC" as const,
      ...(query.skill ? { skills: { has: query.skill.trim() } } : {}),
      ...(query.q ? { OR: [
        { bio: { contains: query.q.trim(), mode: "insensitive" as const } },
        { skills: { has: query.q.trim() } },
      ] } : {}),
    };
    const [total, profiles] = await this.prisma.$transaction([
      this.prisma.collaborationProfile.count({ where }),
      this.prisma.collaborationProfile.findMany({
        where,
        select: {
          coreUserId: true, bio: true, skills: true, githubUrl: true, linkedinUrl: true,
          isAvailable: true, showContributionPoints: true,
          _count: { select: { contributions: { where: { status: "VERIFIED", visibility: "PUBLIC" } } } },
          contributions: {
            where: { status: "VERIFIED", visibility: "PUBLIC" },
            select: { id: true, title: true, role: true, skills: true, verifiedAt: true },
            orderBy: { verifiedAt: "desc" }, take: 3,
          },
        },
        orderBy: [{ isAvailable: "desc" }, { updatedAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    const visibleIds = profiles.filter((profile) => profile.showContributionPoints).map((profile) => profile.coreUserId);
    const transactions = visibleIds.length ? await this.prisma.contributionPointTransaction.groupBy({
      by: ["coreUserId"], where: { coreUserId: { in: visibleIds } }, _sum: { points: true },
    }) : [];
    const totals = new Map(transactions.map((transaction) => [transaction.coreUserId, transaction._sum.points ?? 0]));
    return {
      data: profiles.map((profile) => ({
        coreUserId: profile.coreUserId,
        bio: profile.bio,
        skills: profile.skills,
        githubUrl: profile.githubUrl,
        linkedinUrl: profile.linkedinUrl,
        isAvailable: profile.isAvailable,
        verifiedContributionCount: profile._count.contributions,
        contributions: profile.contributions,
        ...(profile.showContributionPoints ? { points: totals.get(profile.coreUserId) ?? 0 } : {}),
        isCurrentUser: profile.coreUserId === user.coreUserId,
      })),
      meta: { total, page, limit, totalPages: total ? Math.ceil(total / limit) : 0 },
    };
  }

  async publicProfile(user: CoreIdentity, coreUserId: string) {
    const profile = await this.prisma.collaborationProfile.findUnique({
      where: { coreUserId },
      select: {
        coreUserId: true, bio: true, skills: true, githubUrl: true, linkedinUrl: true,
        isAvailable: true, visibility: true, isDiscoverable: true,
        showContributionPoints: true, profileViewsEnabled: true,
        contributions: {
          where: { status: "VERIFIED" },
          select: {
            id: true, title: true, description: true, role: true, skills: true, visibility: true,
            repositoryUrl: true, demoUrl: true, verifiedAt: true, createdAt: true,
            evidence: { select: { id: true, evidenceType: true, url: true, caption: true, createdAt: true } },
            project: { select: { id: true, title: true, status: true } },
          },
          orderBy: { verifiedAt: "desc" },
        },
      },
    });
    if (!profile) throw new NotFoundException("Profile not found");
    const isOwner = profile.coreUserId === user.coreUserId;
    let isSharedTeam = false;
    if (!isOwner) {
      const sharedProject = await this.prisma.project.findFirst({
        where: {
          OR: [
            { coreUserId: profile.coreUserId, members: { some: { coreUserId: user.coreUserId } } },
            { coreUserId: user.coreUserId, members: { some: { coreUserId: profile.coreUserId } } },
            { AND: [
              { members: { some: { coreUserId: profile.coreUserId } } },
              { members: { some: { coreUserId: user.coreUserId } } },
            ] },
          ],
        },
        select: { id: true },
      });
      isSharedTeam = Boolean(sharedProject);
    }
    const canView = isOwner || profile.visibility === "PUBLIC" || (profile.visibility === "TEAM" && isSharedTeam);
    if (!canView) throw new ForbiddenException("โปรไฟล์นี้ไม่ได้เปิดให้คุณดู");
    const visibleContributions = profile.contributions
      .filter((work) => isOwner || work.visibility === "PUBLIC" || (isSharedTeam && work.visibility === "TEAM"))
      .map(({ visibility: _visibility, ...work }) => work);

    if (!isOwner && profile.profileViewsEnabled) {
      const since = new Date(Date.now() - DAY_MS);
      const recentView = await this.prisma.profileViewEvent.findFirst({
        where: { viewerCoreUserId: user.coreUserId, viewedCoreUserId: coreUserId, createdAt: { gte: since } },
        select: { id: true },
      });
      if (!recentView) await this.prisma.profileViewEvent.create({ data: { viewerCoreUserId: user.coreUserId, viewedCoreUserId: coreUserId } });
    }

    let points: number | undefined;
    if (profile.showContributionPoints || isOwner) {
      const total = await this.prisma.contributionPointTransaction.aggregate({ where: { coreUserId }, _sum: { points: true } });
      points = total._sum.points ?? 0;
    }
    const viewCount = isOwner && profile.profileViewsEnabled
      ? await this.prisma.profileViewEvent.count({ where: { viewedCoreUserId: coreUserId, createdAt: { gte: new Date(Date.now() - 30 * DAY_MS) } } })
      : undefined;
    return {
      coreUserId: profile.coreUserId,
      bio: profile.bio,
      skills: profile.skills,
      githubUrl: profile.githubUrl,
      linkedinUrl: profile.linkedinUrl,
      isAvailable: profile.isAvailable,
      visibility: profile.visibility,
      isDiscoverable: profile.isDiscoverable,
      isCurrentUser: isOwner,
      ...(points !== undefined ? { points } : {}),
      ...(viewCount !== undefined ? { profileViewsLast30Days: viewCount } : {}),
      contributions: visibleContributions,
    };
  }

  async updatePrivacy(user: CoreIdentity, input: {
    bio?: string | null; visibility?: "PUBLIC" | "TEAM" | "PRIVATE"; isDiscoverable?: boolean;
    showContributionPoints?: boolean; profileViewsEnabled?: boolean;
  }) {
    const current = await this.prisma.collaborationProfile.findUnique({ where: { coreUserId: user.coreUserId } });
    const nextVisibility = input.visibility ?? (input.isDiscoverable === true ? "PUBLIC" : current?.visibility ?? "PRIVATE");
    const nextDiscoverable = input.isDiscoverable ?? current?.isDiscoverable ?? false;
    if (nextDiscoverable && nextVisibility !== "PUBLIC") {
      throw new ForbiddenException("โปรไฟล์ที่ค้นพบได้ต้องตั้ง visibility เป็น PUBLIC");
    }
    return this.prisma.collaborationProfile.upsert({
      where: { coreUserId: user.coreUserId },
      create: {
        coreUserId: user.coreUserId,
        skills: [],
        isAvailable: true,
        bio: input.bio?.trim() || null,
        visibility: nextVisibility,
        isDiscoverable: nextDiscoverable,
        showContributionPoints: input.showContributionPoints ?? false,
        profileViewsEnabled: input.profileViewsEnabled ?? false,
      },
      update: {
        ...(input.bio !== undefined ? { bio: input.bio?.trim() || null } : {}),
        visibility: nextVisibility,
        isDiscoverable: nextDiscoverable,
        ...(input.showContributionPoints !== undefined ? { showContributionPoints: input.showContributionPoints } : {}),
        ...(input.profileViewsEnabled !== undefined ? { profileViewsEnabled: input.profileViewsEnabled } : {}),
      },
    });
  }

  async profileViews(user: CoreIdentity) {
    const profile = await this.prisma.collaborationProfile.findUnique({ where: { coreUserId: user.coreUserId } });
    if (!profile?.profileViewsEnabled) throw new ForbiddenException("ต้องเปิดสถิติผู้เข้าชมโปรไฟล์ก่อน");
    const since = new Date(Date.now() - 30 * DAY_MS);
    const [total, last30Days] = await Promise.all([
      this.prisma.profileViewEvent.count({ where: { viewedCoreUserId: user.coreUserId } }),
      this.prisma.profileViewEvent.count({ where: { viewedCoreUserId: user.coreUserId, createdAt: { gte: since } } }),
    ]);
    return { total, last30Days, visitorDetailsAvailable: false };
  }
}
