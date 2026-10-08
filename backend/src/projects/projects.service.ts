import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service.js";
import type { CoreIdentity } from "../auth/decorators/current-user.js";
import type { ListProjectsDto, CreateProjectDto, ApplyProjectDto, InviteProjectDto, AskQuestionDto, AnswerQuestionDto, ReviewDto, MessageDto } from "./projects.dto.js";

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly include = {
    roles: true, skills: true,
    members: true,
    applications: true,
    invitations: true,
    questions: true,
    follows: true,
    reviews: true,
  } as const;

  async list(user: CoreIdentity, query: ListProjectsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = {
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.format ? { format: query.format } : {}),
      ...(query.skill ? { skills: { some: { skill: { contains: query.skill, mode: "insensitive" as const } } } } : {}),
      ...(query.mine === "true" ? { coreUserId: user.coreUserId } : {}),
      ...(query.q ? { OR: [
        { title: { contains: query.q, mode: "insensitive" as const } },
        { description: { contains: query.q, mode: "insensitive" as const } },
        { roles: { some: { role: { contains: query.q, mode: "insensitive" as const } } } },
        { skills: { some: { skill: { contains: query.q, mode: "insensitive" as const } } } },
      ] } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({ where, include: this.include, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    ]);
    return { data: rows.map((p) => this.present(p, user)), meta: { total, page, limit, totalPages: total === 0 ? 0 : Math.ceil(total / limit) } };
  }

  async get(user: CoreIdentity, id: string) {
    const p = await this.prisma.project.findUnique({ where: { id }, include: this.include });
    if (!p) throw new NotFoundException("Project not found");
    return this.present(p, user);
  }

  async create(user: CoreIdentity, dto: CreateProjectDto) {
    const p = await this.prisma.project.create({
      data: {
        coreUserId: user.coreUserId,
        title: dto.title.trim(), kind: dto.kind, courseCode: dto.courseCode?.trim() || null,
        size: dto.size, duration: dto.duration?.trim() || null, format: dto.format,
        description: dto.description.trim(), contactText: dto.contactText?.trim() || null,
        roles: { create: this.clean(dto.roles).map((role) => ({ role })) },
        skills: { create: this.clean(dto.skills).map((skill) => ({ skill })) },
      }, include: this.include,
    });
    return this.present(p, user);
  }

  async update(user: CoreIdentity, id: string, dto: CreateProjectDto) {
    const existing = await this.prisma.project.findUnique({ where: { id }, include: this.include });
    this.assertOwner(existing?.coreUserId, user);
    const p = await this.prisma.$transaction(async (tx) => {
      await tx.projectRole.deleteMany({ where: { projectId: id } });
      await tx.projectSkill.deleteMany({ where: { projectId: id } });
      return tx.project.update({
        where: { id },
        data: {
          title: dto.title.trim(), kind: dto.kind, courseCode: dto.courseCode?.trim() || null,
          size: dto.size, duration: dto.duration?.trim() || null, format: dto.format,
          description: dto.description.trim(), contactText: dto.contactText?.trim() || null,
          roles: { create: this.clean(dto.roles).map((role) => ({ role })) },
          skills: { create: this.clean(dto.skills).map((skill) => ({ skill })) },
        }, include: this.include,
      });
    });
    return this.present(p, user);
  }

  async remove(user: CoreIdentity, id: string) {
    const existing = await this.prisma.project.findUnique({ where: { id } });
    this.assertOwner(existing?.coreUserId, user);
    await this.prisma.project.delete({ where: { id } });
    return { id, deleted: true };
  }

  async setStatus(user: CoreIdentity, id: string, status: string) {
    const existing = await this.prisma.project.findUnique({ where: { id } });
    this.assertOwner(existing?.coreUserId, user);
    const p = await this.prisma.project.update({ where: { id }, data: { status: status as any }, include: this.include });
    return this.present(p, user);
  }

  async apply(user: CoreIdentity, id: string, dto: ApplyProjectDto) {
    const p = await this.prisma.project.findUnique({ where: { id }, include: { members: true } });
    if (!p) throw new NotFoundException("Project not found");
    if (p.coreUserId === user.coreUserId) throw new ConflictException("You cannot apply to your own project");
    if (p.status !== "RECRUITING") throw new ConflictException("Project is not recruiting");
    if (p.members.length >= p.size) throw new ConflictException("Project is full");
    const existing = await this.prisma.projectApplication.findUnique({ where: { projectId_coreUserId: { projectId: id, coreUserId: user.coreUserId } } });
    if (existing) throw new ConflictException("Application already exists");
    const app = await this.prisma.projectApplication.create({ data: { projectId: id, coreUserId: user.coreUserId, role: dto.role?.trim() || null, message: dto.message?.trim() || null } });
    await this.notify(p.coreUserId, "APPLICATION_CREATED", id, user.coreUserId, "มีคำขอเข้าร่วมโปรเจกต์ใหม่");
    return app;
  }

  async acceptApplication(user: CoreIdentity, projectId: string, applicationId: string) {
    const application = await this.prisma.projectApplication.findUnique({ where: { id: applicationId } });
    if (!application || application.projectId !== projectId) throw new NotFoundException("Application not found");
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, include: { members: true } });
    if (!project) throw new NotFoundException("Project not found");
    this.assertOwner(project.coreUserId, user);
    if (application.status !== "PENDING") throw new ConflictException("Application is no longer pending");
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "projects" WHERE id = ${projectId} FOR UPDATE`;
      const lockedProject = await tx.project.findUnique({ where: { id: projectId }, include: { members: true } });
      if (!lockedProject) throw new NotFoundException("Project not found");
      if (lockedProject.members.length >= lockedProject.size) throw new ConflictException("Project is full");
      const existingMember = await tx.projectMember.findUnique({ where: { projectId_coreUserId: { projectId, coreUserId: application.coreUserId } } });
      if (existingMember) throw new ConflictException("Applicant is already a project member");
      const result = await tx.projectApplication.update({ where: { id: applicationId }, data: { status: "ACCEPTED" } });
      await tx.projectMember.create({ data: { projectId, coreUserId: application.coreUserId, role: application.role ?? "สมาชิก", message: application.message ?? null } });
      return result;
    });
    await this.notify(application.coreUserId, "APPLICATION_ACCEPTED", projectId, user.coreUserId, "คุณได้รับการตอบรับเข้าร่วมโปรเจกต์");
    return updated;
  }

  async rejectApplication(user: CoreIdentity, projectId: string, applicationId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    this.assertOwner(project?.coreUserId, user);
    const application = await this.prisma.projectApplication.findUnique({ where: { id: applicationId } });
    if (!application || application.projectId !== projectId) throw new NotFoundException("Application not found");
    if (application.status !== "PENDING") throw new ConflictException("Application is no longer pending");
    const updated = await this.prisma.projectApplication.update({ where: { id: applicationId }, data: { status: "REJECTED" } });
    await this.notify(application.coreUserId, "APPLICATION_REJECTED", projectId, user.coreUserId, "คำขอเข้าร่วมโปรเจกต์ถูกปฏิเสธ");
    return updated;
  }

  async invite(user: CoreIdentity, projectId: string, dto: InviteProjectDto) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, include: { members: true } });
    this.assertOwner(project?.coreUserId, user);
    if (!project) throw new NotFoundException("Project not found");
    if (project.members.length >= project.size) throw new ConflictException("Project is full");
    if (dto.inviteeCoreUserId === user.coreUserId) throw new ConflictException("You cannot invite yourself");
    const member = await this.prisma.projectMember.findUnique({ where: { projectId_coreUserId: { projectId, coreUserId: dto.inviteeCoreUserId } } });
    if (member) throw new ConflictException("User is already a project member");
    const existing = await this.prisma.projectInvitation.findUnique({ where: { projectId_inviteeCoreUserId: { projectId, inviteeCoreUserId: dto.inviteeCoreUserId } } });
    if (existing && existing.status === "PENDING") throw new ConflictException("Invitation already exists");
    const invitation = existing
      ? await this.prisma.projectInvitation.update({ where: { id: existing.id }, data: { role: dto.role?.trim() || null, status: "PENDING" } })
      : await this.prisma.projectInvitation.create({ data: { projectId, inviteeCoreUserId: dto.inviteeCoreUserId, role: dto.role?.trim() || null } });
    await this.notify(dto.inviteeCoreUserId, "INVITATION_CREATED", projectId, user.coreUserId, "คุณได้รับคำเชิญเข้าร่วมโปรเจกต์");
    return invitation;
  }

  async respondInvitation(user: CoreIdentity, projectId: string, invitationId: string, accepted: boolean) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, include: { members: true } });
    if (!project) throw new NotFoundException("Project not found");
    const invitation = await this.prisma.projectInvitation.findUnique({ where: { id: invitationId } });
    if (!invitation || invitation.projectId !== projectId || invitation.inviteeCoreUserId !== user.coreUserId) throw new NotFoundException("Invitation not found");
    if (invitation.status !== "PENDING") throw new ConflictException("Invitation is no longer pending");
    if (accepted && project.members.length >= project.size) throw new ConflictException("Project is full");
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "projects" WHERE id = ${projectId} FOR UPDATE`;
      const lockedProject = await tx.project.findUnique({ where: { id: projectId }, include: { members: true } });
      if (!lockedProject) throw new NotFoundException("Project not found");
      if (accepted && lockedProject.members.length >= lockedProject.size) throw new ConflictException("Project is full");
      if (accepted) {
        const existingMember = await tx.projectMember.findUnique({ where: { projectId_coreUserId: { projectId, coreUserId: user.coreUserId } } });
        if (existingMember) throw new ConflictException("You are already a project member");
      }
      const updated = await tx.projectInvitation.update({ where: { id: invitationId }, data: { status: accepted ? "ACCEPTED" : "DECLINED" } });
      if (accepted) await tx.projectMember.create({ data: { projectId, coreUserId: user.coreUserId, role: invitation.role ?? "สมาชิก" } });
      return updated;
    });
    await this.notify(project.coreUserId, accepted ? "INVITATION_ACCEPTED" : "INVITATION_DECLINED", projectId, user.coreUserId, accepted ? "คำเชิญได้รับการตอบรับ" : "คำเชิญถูกปฏิเสธ");
    return result;
  }

  async toggleFollow(user: CoreIdentity, projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException("Project not found");
    const existing = await this.prisma.projectFollow.findUnique({ where: { projectId_coreUserId: { projectId, coreUserId: user.coreUserId } } });
    if (existing) {
      await this.prisma.projectFollow.delete({ where: { id: existing.id } });
      return { following: false };
    }
    await this.prisma.projectFollow.create({ data: { projectId, coreUserId: user.coreUserId } });
    return { following: true };
  }

  async ask(user: CoreIdentity, projectId: string, dto: AskQuestionDto) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException("Project not found");
    const question = await this.prisma.projectQuestion.create({ data: { projectId, askerCoreUserId: user.coreUserId, question: dto.question.trim() } });
    if (project.coreUserId !== user.coreUserId) await this.notify(project.coreUserId, "QUESTION_CREATED", projectId, user.coreUserId, "มีคำถามใหม่ในโปรเจกต์");
    return question;
  }

  async answer(user: CoreIdentity, projectId: string, questionId: string, dto: AnswerQuestionDto) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    this.assertOwner(project?.coreUserId, user);
    const question = await this.prisma.projectQuestion.findUnique({ where: { id: questionId } });
    if (!question || question.projectId !== projectId) throw new NotFoundException("Question not found");
    return this.prisma.projectQuestion.update({ where: { id: questionId }, data: { answer: dto.answer.trim(), answeredAt: new Date() } });
  }

  async review(user: CoreIdentity, projectId: string, dto: ReviewDto) {
    if (dto.stars < 1 || dto.stars > 5) throw new ConflictException("Stars must be between 1 and 5");
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, include: { members: true } });
    if (!project) throw new NotFoundException("Project not found");
    if (project.status !== "COMPLETED") throw new ConflictException("Project must be completed before review");
    const isMember = project.coreUserId === user.coreUserId || project.members.some((m) => m.coreUserId === user.coreUserId);
    const targetIsMember = project.coreUserId === dto.toCoreUserId || project.members.some((m) => m.coreUserId === dto.toCoreUserId);
    if (!isMember || !targetIsMember || dto.toCoreUserId === user.coreUserId) throw new ForbiddenException("Review is limited to project participants");
    const existing = await this.prisma.projectReview.findUnique({ where: { projectId_fromCoreUserId_toCoreUserId: { projectId, fromCoreUserId: user.coreUserId, toCoreUserId: dto.toCoreUserId } } });
    if (existing) throw new ConflictException("Review already exists");
    const review = await this.prisma.projectReview.create({ data: { projectId, fromCoreUserId: user.coreUserId, toCoreUserId: dto.toCoreUserId, stars: dto.stars, comment: dto.comment?.trim() || null } });
    await this.notify(dto.toCoreUserId, "REVIEW_CREATED", projectId, user.coreUserId, "คุณได้รับรีวิวจากสมาชิกโปรเจกต์");
    return review;
  }

  async conversations(user: CoreIdentity) {
    return this.prisma.conversation.findMany({ where: { participants: { some: { coreUserId: user.coreUserId } } }, include: { participants: true, messages: { orderBy: { createdAt: "asc" }, take: 1 } }, orderBy: { updatedAt: "desc" } });
  }

  async conversation(user: CoreIdentity, otherCoreUserId: string) {
    if (otherCoreUserId === user.coreUserId) throw new ConflictException("You cannot message yourself");
    const conversations = await this.prisma.conversation.findMany({ where: { participants: { every: { coreUserId: { in: [user.coreUserId, otherCoreUserId] } } } }, include: { participants: true } });
    const existing = conversations.find((c) => c.participants.length === 2);
    if (existing) return existing;
    return this.prisma.conversation.create({ data: { participants: { create: [{ coreUserId: user.coreUserId }, { coreUserId: otherCoreUserId }] } }, include: { participants: true } });
  }

  async messages(user: CoreIdentity, conversationId: string) {
    await this.assertParticipant(user, conversationId);
    return this.prisma.message.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" } });
  }

  async sendMessage(user: CoreIdentity, conversationId: string, dto: MessageDto) {
    await this.assertParticipant(user, conversationId);
    const message = await this.prisma.message.create({ data: { conversationId, senderCoreUserId: user.coreUserId, body: dto.body.trim() } });
    const participants = await this.prisma.conversationParticipant.findMany({ where: { conversationId, coreUserId: { not: user.coreUserId } } });
    for (const p of participants) await this.notify(p.coreUserId, "MESSAGE_CREATED", undefined, user.coreUserId, "มีข้อความใหม่");
    return message;
  }

  async notifications(user: CoreIdentity) {
    return this.prisma.notification.findMany({ where: { coreUserId: user.coreUserId }, orderBy: { createdAt: "desc" }, take: 50 });
  }

  async readNotification(user: CoreIdentity, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notification || notification.coreUserId !== user.coreUserId) throw new NotFoundException("Notification not found");
    return this.prisma.notification.update({ where: { id: notificationId }, data: { isRead: true } });
  }

  private async assertParticipant(user: CoreIdentity, conversationId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({ where: { conversationId_coreUserId: { conversationId, coreUserId: user.coreUserId } } });
    if (!participant) throw new ForbiddenException("You are not a conversation participant");
  }

  private async notify(coreUserId: string, type: string, projectId: string | undefined, actorCoreUserId: string | undefined, message: string) {
    await this.prisma.notification.create({ data: { coreUserId, type, projectId, actorCoreUserId, message } });
  }

  private clean(values: string[]) { return [...new Set(values.map((v) => v.trim()).filter(Boolean))]; }
  private assertOwner(ownerId: string | undefined, user: CoreIdentity) { if (!ownerId) throw new NotFoundException("Project not found"); if (ownerId !== user.coreUserId) throw new ForbiddenException("You do not own this project"); }
  private present(p: any, user: CoreIdentity) {
    const acceptedCount = p.members.length;
    const ratingRows = p.reviews.filter((r: any) => r.toCoreUserId === p.coreUserId);
    const ownerRating = ratingRows.length ? Number((ratingRows.reduce((sum: number, r: any) => sum + r.stars, 0) / ratingRows.length).toFixed(1)) : null;
    return {
      id: p.id, title: p.title, kind: p.kind, courseCode: p.courseCode, size: p.size,
      duration: p.duration, format: p.format, description: p.description, status: p.status,
      contactText: p.contactText, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
      owner: { coreUserId: p.coreUserId, isCurrentUser: p.coreUserId === user.coreUserId, rating: ownerRating },
      roles: p.roles.map((r: any) => r.role), skills: p.skills.map((s: any) => s.skill),
      members: p.members.map((m: any) => ({ id: m.id, coreUserId: m.coreUserId, isCurrentUser: m.coreUserId === user.coreUserId, role: m.role, message: m.message, joinedAt: m.joinedAt.toISOString() })),
      applications: p.applications.map((a: any) => ({ id: a.id, coreUserId: a.coreUserId, isCurrentUser: a.coreUserId === user.coreUserId, role: a.role, message: a.message, status: a.status, createdAt: a.createdAt.toISOString() })),
      invitations: p.invitations.map((i: any) => ({ id: i.id, inviteeCoreUserId: i.inviteeCoreUserId, isCurrentUser: i.inviteeCoreUserId === user.coreUserId, role: i.role, status: i.status, createdAt: i.createdAt.toISOString() })),
      questions: p.questions.map((q: any) => ({ id: q.id, askerCoreUserId: q.askerCoreUserId, isCurrentUser: q.askerCoreUserId === user.coreUserId, question: q.question, answer: q.answer, answeredAt: q.answeredAt?.toISOString() ?? null, createdAt: q.createdAt.toISOString() })),
      isFollowing: p.follows.some((f: any) => f.coreUserId === user.coreUserId),
      acceptedCount,
      remainingSlots: Math.max(0, p.size - acceptedCount),
      currentApplication: p.applications.find((a: any) => a.coreUserId === user.coreUserId) ?? null,
      currentInvitation: p.invitations.find((i: any) => i.inviteeCoreUserId === user.coreUserId) ?? null,
    };
  }
}
