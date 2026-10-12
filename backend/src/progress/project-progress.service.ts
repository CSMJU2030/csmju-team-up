import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service.js";
import type { CoreIdentity } from "../auth/decorators/current-user.js";
import { contributionPointsFor, type WorkSize } from "../contributions/contributions.service.js";

export type ProgressStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "IN_REVIEW" | "COMPLETED";

function configuredBonus(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0 || value > 1000) throw new Error(`${key} must be an integer from 0 to 1000`);
  return value;
}

@Injectable()
export class ProjectProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async getProgress(user: CoreIdentity, projectId: string) {
    const project = await this.projectForMember(user, projectId);
    const [milestones, tasks, events] = await Promise.all([
      this.prisma.projectMilestone.findMany({
        where: { projectId }, include: { tasks: { include: { submissions: { orderBy: { submittedAt: "desc" }, take: 3 } } } },
        orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
      }),
      this.prisma.projectTask.findMany({ where: { projectId }, orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }], include: { submissions: { orderBy: { submittedAt: "desc" }, take: 3 } } }),
      this.prisma.projectProgressEvent.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, take: 100 }),
    ]);
    const totalWeight = tasks.reduce((sum, task) => sum + task.weight, 0);
    const completedWeight = tasks.filter((task) => task.status === "COMPLETED").reduce((sum, task) => sum + task.weight, 0);
    const now = new Date();
    return {
      project: {
        id: project.id, title: project.title, status: project.status, isOwner: project.coreUserId === user.coreUserId,
        teamMembers: [{ coreUserId: project.coreUserId, isOwner: true }, ...project.members.map((member) => ({ coreUserId: member.coreUserId, isOwner: false }))],
      },
      progressPercent: totalWeight ? Math.round((completedWeight / totalWeight) * 100) : 0,
      summary: {
        totalTasks: tasks.length,
        completedTasks: tasks.filter((task) => task.status === "COMPLETED").length,
        blockedTasks: tasks.filter((task) => task.status === "BLOCKED").length,
        reviewTasks: tasks.filter((task) => task.status === "IN_REVIEW").length,
        overdueTasks: tasks.filter((task) => task.dueAt && task.dueAt < now && task.status !== "COMPLETED").length,
      },
      milestones: milestones.map((milestone) => ({ ...milestone, progressPercent: weightedProgress(milestone.tasks) })),
      tasks,
      events,
    };
  }

  async createMilestone(user: CoreIdentity, projectId: string, input: { title: string; description?: string; dueAt?: string; weight?: number }) {
    await this.projectForOwner(user, projectId);
    return this.prisma.$transaction(async (tx) => {
      const milestone = await tx.projectMilestone.create({
        data: {
          projectId, title: input.title.trim(), description: input.description?.trim() || null,
          dueAt: input.dueAt ? new Date(input.dueAt) : null, weight: input.weight ?? 1, createdByCoreUserId: user.coreUserId,
        },
      });
      await tx.projectProgressEvent.create({ data: { projectId, entityId: milestone.id, actorCoreUserId: user.coreUserId, eventType: "MILESTONE_CREATED", message: `สร้าง milestone: ${milestone.title}` } });
      return milestone;
    });
  }

  async updateMilestone(user: CoreIdentity, projectId: string, milestoneId: string, input: { title?: string; description?: string | null; dueAt?: string | null; status?: ProgressStatus; weight?: number }) {
    await this.projectForOwner(user, projectId);
    const milestone = await this.prisma.projectMilestone.findFirst({ where: { id: milestoneId, projectId }, include: { tasks: true } });
    if (!milestone) throw new NotFoundException("ไม่พบ milestone ของโปรเจกต์นี้");
    if (input.status === "COMPLETED" && (milestone.tasks.length === 0 || milestone.tasks.some((task) => task.status !== "COMPLETED"))) {
      throw new ConflictException("ปิด milestone ได้เมื่อมีงานย่อยและงานย่อยทั้งหมดเสร็จผ่านการตรวจแล้ว");
    }
    if (input.status === "IN_REVIEW") throw new ConflictException("Milestone ไม่มีขั้นตอนส่งตรวจโดยตรง ให้ตรวจงานย่อยและปิด milestone เมื่อเสร็จ");
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.projectMilestone.updateMany({
        where: { id: milestoneId, ...(input.status === "COMPLETED" ? { status: { not: "COMPLETED" } } : {}) },
        data: {
          ...(input.title !== undefined ? { title: input.title.trim() } : {}),
          ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
          ...(input.dueAt !== undefined ? { dueAt: input.dueAt ? new Date(input.dueAt) : null } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.weight !== undefined ? { weight: input.weight } : {}),
        },
      });
      if (changed.count !== 1) throw new ConflictException("milestone เปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลใหม่");
      if (input.status === "COMPLETED" && milestone.status !== "COMPLETED") {
        const recipients = [...new Set(milestone.tasks.map((task) => task.assignedCoreUserId).filter((id): id is string => id !== null))];
        const points = configuredBonus("CONTRIBUTION_POINTS_MILESTONE", 10);
        if (points > 0 && recipients.length) {
          await tx.contributionPointTransaction.createMany({
            data: recipients.map((coreUserId) => ({
              coreUserId, points, transactionType: "AWARD" as const, reason: `ปิด milestone: ${milestone.title}`,
              eventKey: `milestone-award:${milestone.id}:${coreUserId}`, createdByCoreUserId: user.coreUserId,
            })),
            skipDuplicates: true,
          });
        }
        await tx.notification.createMany({
          data: recipients.map((coreUserId) => ({ coreUserId, type: "MILESTONE_COMPLETED", projectId, actorCoreUserId: user.coreUserId, message: `ปิด milestone แล้ว: ${milestone.title}` })),
        });
      }
      await tx.projectProgressEvent.create({ data: { projectId, entityId: milestoneId, actorCoreUserId: user.coreUserId, eventType: input.status === "COMPLETED" ? "MILESTONE_COMPLETED" : "MILESTONE_UPDATED", message: `${input.status === "COMPLETED" ? "ปิด" : "อัปเดต"} milestone: ${milestone.title}` } });
      return tx.projectMilestone.findUniqueOrThrow({ where: { id: milestoneId } });
    });
  }

  async createTask(user: CoreIdentity, projectId: string, input: { milestoneId?: string; title: string; description?: string; assignedCoreUserId?: string; dueAt?: string; workSize: WorkSize; weight?: number }) {
    const project = await this.projectForOwner(user, projectId);
    if (input.milestoneId) {
      const milestone = await this.prisma.projectMilestone.findFirst({ where: { id: input.milestoneId, projectId }, select: { id: true } });
      if (!milestone) throw new BadRequestException("milestone ต้องอยู่ในโปรเจกต์เดียวกัน");
    }
    if (input.assignedCoreUserId === project.coreUserId) throw new BadRequestException("เจ้าของโปรเจกต์เป็นผู้ตรวจงาน จึงไม่สามารถมอบหมายงานที่ต้องส่งตรวจให้ตัวเองได้");
    if (input.assignedCoreUserId) {
      const member = await this.prisma.projectMember.findUnique({ where: { projectId_coreUserId: { projectId, coreUserId: input.assignedCoreUserId } } });
      if (!member) throw new BadRequestException("ผู้รับผิดชอบต้องเป็นสมาชิกของโปรเจกต์");
    }
    const assigneeCoreUserId = input.assignedCoreUserId;
    if (!assigneeCoreUserId) throw new BadRequestException("ต้องกำหนดสมาชิกผู้รับผิดชอบงาน");
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.projectTask.create({
        data: {
          projectId, milestoneId: input.milestoneId, title: input.title.trim(), description: input.description?.trim() || null,
          assignedCoreUserId: assigneeCoreUserId, dueAt: input.dueAt ? new Date(input.dueAt) : null,
          workSize: input.workSize, weight: input.weight ?? 1, createdByCoreUserId: user.coreUserId,
        },
      });
      await tx.projectProgressEvent.create({ data: { projectId, entityId: task.id, actorCoreUserId: user.coreUserId, eventType: "TASK_CREATED", message: `สร้างงาน: ${task.title}` } });
      await tx.notification.create({ data: { coreUserId: assigneeCoreUserId, type: "TASK_ASSIGNED", projectId, actorCoreUserId: user.coreUserId, message: `มีงานใหม่ที่มอบหมายให้คุณ: ${task.title}` } });
      return task;
    });
  }

  async updateTask(user: CoreIdentity, projectId: string, taskId: string, input: { title?: string; description?: string | null; progressNote?: string | null; blockerNote?: string | null; assignedCoreUserId?: string | null; dueAt?: string | null; status?: ProgressStatus; weight?: number }) {
    const project = await this.projectForMember(user, projectId);
    const task = await this.prisma.projectTask.findFirst({ where: { id: taskId, projectId } });
    if (!task) throw new NotFoundException("ไม่พบงานของโปรเจกต์นี้");
    const isOwner = project.coreUserId === user.coreUserId;
    if (task.status === "IN_REVIEW" && input.status !== undefined) throw new ConflictException("เปลี่ยนสถานะไม่ได้ระหว่างรอเจ้าของตรวจ submission");
    if (!isOwner && task.assignedCoreUserId !== user.coreUserId) throw new ForbiddenException("แก้ไขได้เฉพาะงานที่มอบหมายให้คุณ");
    if (isOwner && input.assignedCoreUserId === project.coreUserId) throw new BadRequestException("เจ้าของโปรเจกต์เป็นผู้ตรวจงาน จึงไม่สามารถมอบหมายงานที่ต้องส่งตรวจให้ตัวเองได้");
    if (isOwner && input.assignedCoreUserId) {
      const member = await this.prisma.projectMember.findUnique({ where: { projectId_coreUserId: { projectId, coreUserId: input.assignedCoreUserId } }, select: { id: true } });
      if (!member) throw new BadRequestException("ผู้รับผิดชอบต้องเป็นสมาชิกของโปรเจกต์");
    }
    if (input.status === "COMPLETED" || input.status === "IN_REVIEW") {
      throw new ConflictException("สถานะ COMPLETED/IN_REVIEW ต้องเกิดจาก workflow ส่งงานและอนุมัติเท่านั้น");
    }
    if ((input.status ?? task.status) === "BLOCKED" && !(input.blockerNote ?? task.blockerNote)?.trim()) {
      throw new BadRequestException("กรุณาระบุสาเหตุที่งานติดปัญหา");
    }
    if (!isOwner && input.status && !["TODO", "IN_PROGRESS", "BLOCKED"].includes(input.status)) {
      throw new ForbiddenException("สมาชิกเปลี่ยนสถานะได้เฉพาะ TODO, IN_PROGRESS หรือ BLOCKED");
    }
    if (!isOwner && Object.keys(input).some((key) => !["status", "progressNote", "blockerNote"].includes(key))) throw new ForbiddenException("สมาชิกแก้ได้เฉพาะสถานะและความคืบหน้าของงานที่ได้รับมอบหมาย");
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.projectTask.update({
        where: { id: taskId },
        data: {
          ...(input.title !== undefined ? { title: input.title.trim() } : {}),
          ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
          ...(input.progressNote !== undefined ? { progressNote: input.progressNote?.trim() || null } : {}),
          ...(input.blockerNote !== undefined ? { blockerNote: input.blockerNote?.trim() || null } : {}),
          ...(input.assignedCoreUserId !== undefined ? { assignedCoreUserId: input.assignedCoreUserId || null } : {}),
          ...(input.dueAt !== undefined ? { dueAt: input.dueAt ? new Date(input.dueAt) : null } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.weight !== undefined ? { weight: input.weight } : {}),
          ...(input.status !== undefined && input.status !== "BLOCKED" && input.blockerNote === undefined ? { blockerNote: null } : {}),
        },
      });
      const updateNote = (input.blockerNote?.trim() || input.progressNote?.trim())?.slice(0, 300);
      await tx.projectProgressEvent.create({
        data: {
          projectId, entityId: taskId, actorCoreUserId: user.coreUserId,
          eventType: input.status === "BLOCKED" ? "TASK_BLOCKED" : "TASK_UPDATED",
          message: `${input.status === "BLOCKED" ? "แจ้งติดปัญหา" : "อัปเดตงาน"}: ${updated.title}${updateNote ? ` — ${updateNote}` : ""}`,
        },
      });
      if (input.assignedCoreUserId && input.assignedCoreUserId !== task.assignedCoreUserId) {
        await tx.notification.create({ data: { coreUserId: input.assignedCoreUserId, type: "TASK_ASSIGNED", projectId, actorCoreUserId: user.coreUserId, message: `มีงานที่มอบหมายให้คุณ: ${updated.title}` } });
      }
      if (input.status === "BLOCKED" && task.status !== "BLOCKED") {
        await tx.notification.create({ data: { coreUserId: project.coreUserId, type: "TASK_BLOCKED", projectId, actorCoreUserId: user.coreUserId, message: `งานติดปัญหา: ${updated.title}${updated.blockerNote ? ` — ${updated.blockerNote}` : ""}` } });
      }
      return updated;
    });
  }

  async submitTask(user: CoreIdentity, projectId: string, taskId: string, input: { url?: string; note: string }) {
    const project = await this.projectForMember(user, projectId);
    const task = await this.prisma.projectTask.findFirst({ where: { id: taskId, projectId }, include: { submissions: { where: { status: "PENDING" }, select: { id: true } } } });
    if (!task) throw new NotFoundException("ไม่พบงานของโปรเจกต์นี้");
    if (project.coreUserId === user.coreUserId) throw new ForbiddenException("เจ้าของโปรเจกต์ต้องเป็นผู้ตรวจ ไม่ใช่ผู้ส่งงาน");
    if (!task.assignedCoreUserId || task.assignedCoreUserId !== user.coreUserId) throw new ForbiddenException("ส่งงานได้เฉพาะสมาชิกที่ได้รับมอบหมาย");
    if (!input.url?.trim()) throw new BadRequestException("ต้องแนบลิงก์หลักฐานก่อนส่งงาน");
    if (task.status === "COMPLETED") throw new ConflictException("งานนี้เสร็จสมบูรณ์แล้ว");
    if (task.submissions.length || task.status === "IN_REVIEW") throw new ConflictException("มี submission ที่รอตรวจอยู่แล้ว");
    return this.prisma.$transaction(async (tx) => {
      const reserved = await tx.projectTask.updateMany({
        where: { id: taskId, projectId, status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] } },
        data: { status: "IN_REVIEW" },
      });
      if (reserved.count !== 1) throw new ConflictException("งานนี้เปลี่ยนสถานะแล้ว กรุณาโหลดข้อมูลใหม่");
      const pending = await tx.taskSubmission.findFirst({ where: { taskId, status: "PENDING" }, select: { id: true } });
      if (pending) throw new ConflictException("มี submission ที่รอตรวจอยู่แล้ว");
      const submission = await tx.taskSubmission.create({
        data: { taskId, submittedByCoreUserId: user.coreUserId, url: input.url?.trim() || null, note: input.note.trim() },
      });
      await tx.projectProgressEvent.create({ data: { projectId, entityId: taskId, actorCoreUserId: user.coreUserId, eventType: "TASK_SUBMITTED", message: `ส่งงานตรวจ: ${task.title}` } });
      await tx.notification.create({ data: { coreUserId: project.coreUserId, type: "TASK_SUBMITTED", projectId, actorCoreUserId: user.coreUserId, message: `มีงานรอตรวจ: ${task.title}` } });
      return submission;
    });
  }

  async reviewSubmission(user: CoreIdentity, projectId: string, taskId: string, submissionId: string, input: { decision: "APPROVE" | "REJECT"; reviewNote?: string }) {
    await this.projectForOwner(user, projectId);
    const submission = await this.prisma.taskSubmission.findFirst({ where: { id: submissionId, taskId, task: { projectId } }, include: { task: true } });
    if (!submission) throw new NotFoundException("ไม่พบ submission นี้");
    if (submission.submittedByCoreUserId === user.coreUserId) throw new ForbiddenException("ไม่สามารถตรวจงานที่ส่งด้วยตัวเองได้");
    if (submission.status !== "PENDING") throw new ConflictException("submission นี้ถูกตรวจไปแล้ว");
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.taskSubmission.updateMany({
        where: { id: submissionId, status: "PENDING" },
        data: {
          status: input.decision === "APPROVE" ? "APPROVED" : "REJECTED",
          reviewedByCoreUserId: user.coreUserId,
          reviewNote: input.reviewNote?.trim() || null,
          reviewedAt: new Date(),
        },
      });
      if (updated.count !== 1) throw new ConflictException("submission นี้ถูกตรวจโดยผู้ใช้อื่นแล้ว");
      const taskUpdated = await tx.projectTask.update({
        where: { id: taskId },
        data: { status: input.decision === "APPROVE" ? "COMPLETED" : "IN_PROGRESS" },
      });
      if (input.decision === "APPROVE") {
        const points = contributionPointsFor(submission.task.workSize);
        if (points > 0) {
          await tx.contributionPointTransaction.create({
            data: {
              coreUserId: submission.submittedByCoreUserId, points, transactionType: "AWARD",
              reason: `ผ่านการตรวจงาน: ${taskUpdated.title}`, eventKey: `project-task-award:${taskId}`,
              createdByCoreUserId: user.coreUserId,
            },
          });
        }
      }
      await tx.projectProgressEvent.create({ data: { projectId, entityId: taskId, actorCoreUserId: user.coreUserId, eventType: input.decision === "APPROVE" ? "TASK_APPROVED" : "TASK_REJECTED", message: `${input.decision === "APPROVE" ? "อนุมัติ" : "ส่งกลับแก้ไข"}งาน: ${taskUpdated.title}` } });
      await tx.notification.create({ data: { coreUserId: submission.submittedByCoreUserId, type: input.decision === "APPROVE" ? "TASK_APPROVED" : "TASK_REJECTED", projectId, actorCoreUserId: user.coreUserId, message: `${input.decision === "APPROVE" ? "อนุมัติ" : "ส่งกลับแก้ไข"}งาน: ${taskUpdated.title}` } });
      return tx.taskSubmission.findUnique({ where: { id: submissionId } });
    });
  }

  private async projectForMember(user: CoreIdentity, projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, include: { members: true } });
    if (!project) throw new NotFoundException("ไม่พบโปรเจกต์");
    if (project.coreUserId !== user.coreUserId && !project.members.some((member) => member.coreUserId === user.coreUserId)) {
      throw new ForbiddenException("ดูความคืบหน้าได้เฉพาะสมาชิกโปรเจกต์");
    }
    return project;
  }

  private async projectForOwner(user: CoreIdentity, projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException("ไม่พบโปรเจกต์");
    if (project.coreUserId !== user.coreUserId) throw new ForbiddenException("เฉพาะเจ้าของโปรเจกต์ที่จัดการ milestone และตรวจงานได้");
    if (project.status === "COMPLETED") throw new ConflictException("โปรเจกต์ที่ปิดแล้วไม่สามารถแก้ไขงานหรือ milestone ได้");
    return project;
  }
}

export function weightedProgress(tasks: Array<{ status: string; weight: number }>): number {
  const weight = tasks.reduce((sum, task) => sum + task.weight, 0);
  if (!weight) return 0;
  return Math.round((tasks.filter((task) => task.status === "COMPLETED").reduce((sum, task) => sum + task.weight, 0) / weight) * 100);
}
