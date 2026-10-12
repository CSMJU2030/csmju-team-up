import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUrl, IsUUID, Max, MaxLength, Min, MinLength } from "class-validator";
import { CoreHubJwtGuard } from "../auth/guards/core-hub-jwt.guard.js";
import { PermissionsGuard } from "../auth/guards/permissions.guard.js";
import { RequirePermissions } from "../auth/decorators/permissions.js";
import { CurrentUser } from "../auth/decorators/current-user.js";
import type { CoreIdentity } from "../auth/decorators/current-user.js";
import { Permission } from "../auth/permissions.js";
import { ProjectProgressService, type ProgressStatus } from "./project-progress.service.js";

const MILESTONE_STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "COMPLETED"] as const;
const MANUAL_TASK_STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED"] as const;
class CreateMilestoneDto {
  @ApiProperty({ minLength: 1, maxLength: 160 }) @IsString() @MinLength(1) @MaxLength(160) title!: string;
  @ApiPropertyOptional({ maxLength: 2000 }) @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @ApiPropertyOptional({ format: "date-time" }) @IsOptional() @IsISO8601() dueAt?: string;
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 1 }) @IsOptional() @IsInt() @Min(1) @Max(100) weight?: number;
}
class UpdateMilestoneDto {
  @ApiPropertyOptional({ maxLength: 160 }) @IsOptional() @IsString() @MinLength(1) @MaxLength(160) title?: string;
  @ApiPropertyOptional({ maxLength: 2000 }) @IsOptional() @IsString() @MaxLength(2000) description?: string | null;
  @ApiPropertyOptional({ format: "date-time", nullable: true }) @IsOptional() @IsISO8601() dueAt?: string | null;
  @ApiPropertyOptional({ enum: MILESTONE_STATUSES }) @IsOptional() @IsIn(MILESTONE_STATUSES) status?: Exclude<ProgressStatus, "IN_REVIEW">;
  @ApiPropertyOptional({ minimum: 1, maximum: 100 }) @IsOptional() @IsInt() @Min(1) @Max(100) weight?: number;
}
class CreateTaskDto {
  @ApiProperty({ minLength: 1, maxLength: 160 }) @IsString() @MinLength(1) @MaxLength(160) title!: string;
  @ApiPropertyOptional({ maxLength: 2000 }) @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID("4") milestoneId?: string;
  @ApiPropertyOptional({ maxLength: 64 }) @IsOptional() @IsString() @MaxLength(64) assignedCoreUserId?: string;
  @ApiPropertyOptional({ format: "date-time" }) @IsOptional() @IsISO8601() dueAt?: string;
  @ApiProperty({ enum: ["SMALL", "MEDIUM", "LARGE"], default: "SMALL" }) @IsIn(["SMALL", "MEDIUM", "LARGE"]) workSize!: "SMALL" | "MEDIUM" | "LARGE";
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 1 }) @IsOptional() @IsInt() @Min(1) @Max(100) weight?: number;
}
class UpdateTaskDto {
  @ApiPropertyOptional({ maxLength: 160 }) @IsOptional() @IsString() @MinLength(1) @MaxLength(160) title?: string;
  @ApiPropertyOptional({ maxLength: 2000 }) @IsOptional() @IsString() @MaxLength(2000) description?: string | null;
  @ApiPropertyOptional({ maxLength: 2000 }) @IsOptional() @IsString() @MaxLength(2000) progressNote?: string | null;
  @ApiPropertyOptional({ maxLength: 1000 }) @IsOptional() @IsString() @MaxLength(1000) blockerNote?: string | null;
  @ApiPropertyOptional({ maxLength: 64, nullable: true }) @IsOptional() @IsString() @MaxLength(64) assignedCoreUserId?: string | null;
  @ApiPropertyOptional({ format: "date-time", nullable: true }) @IsOptional() @IsISO8601() dueAt?: string | null;
  @ApiPropertyOptional({ enum: MANUAL_TASK_STATUSES }) @IsOptional() @IsIn(MANUAL_TASK_STATUSES) status?: Exclude<ProgressStatus, "IN_REVIEW" | "COMPLETED">;
  @ApiPropertyOptional({ minimum: 1, maximum: 100 }) @IsOptional() @IsInt() @Min(1) @Max(100) weight?: number;
}
class TaskSubmissionDto {
  @ApiProperty({ format: "uri", maxLength: 1000 }) @IsUrl({ protocols: ["https"], require_protocol: true }) @MaxLength(1000) url!: string;
  @ApiProperty({ minLength: 1, maxLength: 2000 }) @IsString() @MinLength(1) @MaxLength(2000) note!: string;
}
class ReviewTaskSubmissionDto {
  @ApiProperty({ enum: ["APPROVE", "REJECT"] }) @IsIn(["APPROVE", "REJECT"]) decision!: "APPROVE" | "REJECT";
  @ApiPropertyOptional({ maxLength: 1000 }) @IsOptional() @IsString() @MaxLength(1000) reviewNote?: string;
}

@ApiTags("Project Progress")
@ApiCookieAuth()
@Controller("v1/projects")
@UseGuards(CoreHubJwtGuard, PermissionsGuard)
export class ProjectProgressController {
  constructor(private readonly progress: ProjectProgressService) {}

  @Get(":projectId/progress")
  @RequirePermissions(Permission.PROJECT_PROGRESS_READ)
  getProgress(@CurrentUser() user: CoreIdentity, @Param("projectId", new ParseUUIDPipe({ version: "4" })) projectId: string) {
    return this.progress.getProgress(user, projectId);
  }

  @Post(":projectId/milestones")
  @RequirePermissions(Permission.PROJECT_PROGRESS_MANAGE_OWN)
  createMilestone(@CurrentUser() user: CoreIdentity, @Param("projectId", new ParseUUIDPipe({ version: "4" })) projectId: string, @Body() dto: CreateMilestoneDto) {
    return this.progress.createMilestone(user, projectId, dto);
  }

  @Patch(":projectId/milestones/:milestoneId")
  @RequirePermissions(Permission.PROJECT_PROGRESS_MANAGE_OWN)
  updateMilestone(@CurrentUser() user: CoreIdentity, @Param("projectId", new ParseUUIDPipe({ version: "4" })) projectId: string, @Param("milestoneId", new ParseUUIDPipe({ version: "4" })) milestoneId: string, @Body() dto: UpdateMilestoneDto) {
    return this.progress.updateMilestone(user, projectId, milestoneId, dto);
  }

  @Post(":projectId/tasks")
  @RequirePermissions(Permission.PROJECT_PROGRESS_MANAGE_OWN)
  createTask(@CurrentUser() user: CoreIdentity, @Param("projectId", new ParseUUIDPipe({ version: "4" })) projectId: string, @Body() dto: CreateTaskDto) {
    return this.progress.createTask(user, projectId, dto);
  }

  @Patch(":projectId/tasks/:taskId")
  @RequirePermissions(Permission.PROJECT_TASK_UPDATE_ASSIGNED)
  updateTask(@CurrentUser() user: CoreIdentity, @Param("projectId", new ParseUUIDPipe({ version: "4" })) projectId: string, @Param("taskId", new ParseUUIDPipe({ version: "4" })) taskId: string, @Body() dto: UpdateTaskDto) {
    return this.progress.updateTask(user, projectId, taskId, dto);
  }

  @Post(":projectId/tasks/:taskId/submissions")
  @RequirePermissions(Permission.PROJECT_TASK_UPDATE_ASSIGNED)
  submitTask(@CurrentUser() user: CoreIdentity, @Param("projectId", new ParseUUIDPipe({ version: "4" })) projectId: string, @Param("taskId", new ParseUUIDPipe({ version: "4" })) taskId: string, @Body() dto: TaskSubmissionDto) {
    return this.progress.submitTask(user, projectId, taskId, dto);
  }

  @Post(":projectId/tasks/:taskId/submissions/:submissionId/review")
  @RequirePermissions(Permission.PROJECT_PROGRESS_MANAGE_OWN)
  reviewSubmission(@CurrentUser() user: CoreIdentity, @Param("projectId", new ParseUUIDPipe({ version: "4" })) projectId: string, @Param("taskId", new ParseUUIDPipe({ version: "4" })) taskId: string, @Param("submissionId", new ParseUUIDPipe({ version: "4" })) submissionId: string, @Body() dto: ReviewTaskSubmissionDto) {
    return this.progress.reviewSubmission(user, projectId, taskId, submissionId, dto);
  }
}
