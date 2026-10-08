import { PermissionsGuard } from "../auth/guards/permissions.guard.js";
import { RequirePermissions } from "../auth/decorators/permissions.js";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsEnum, IsOptional } from "class-validator";
import { CoreHubJwtGuard } from "../auth/guards/core-hub-jwt.guard.js";
import { CurrentUser } from "../auth/decorators/current-user.js";
import type { CoreIdentity } from "../auth/decorators/current-user.js";
import { Permission } from "../auth/permissions.js";
import { ApplyProjectDto, AskQuestionDto, AnswerQuestionDto, CreateProjectDto, InviteProjectDto, ListProjectsDto, ReviewDto, ProjectStatusDto } from "./projects.dto.js";
import { ProjectsService } from "./projects.service.js";

class ProjectListQuery extends ListProjectsDto {
  @IsOptional() @Type(() => Number) declare page: number;
  @IsOptional() @Type(() => Number) declare limit: number;
  @IsOptional() @IsEnum(ProjectStatusDto) declare status?: ProjectStatusDto;
}
class StatusDto { @IsEnum(ProjectStatusDto) status!: ProjectStatusDto; }

@ApiTags("Projects")
@ApiCookieAuth()
@Controller("v1/projects")
@UseGuards(CoreHubJwtGuard, PermissionsGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}
  @Get() @RequirePermissions(Permission.PROJECT_READ_ANY) list(@CurrentUser() user: CoreIdentity, @Query() query: ProjectListQuery) { return this.projects.list(user, query); }
  @Get(":id") @RequirePermissions(Permission.PROJECT_READ_ANY) get(@CurrentUser() user: CoreIdentity, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) { return this.projects.get(user, id); }
  @Post() @RequirePermissions(Permission.PROJECT_CREATE) create(@CurrentUser() user: CoreIdentity, @Body() dto: CreateProjectDto) { return this.projects.create(user, dto); }
  @Patch(":id") @RequirePermissions(Permission.PROJECT_UPDATE_OWN) update(@CurrentUser() user: CoreIdentity, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() dto: CreateProjectDto) { return this.projects.update(user, id, dto); }
  @Delete(":id") @RequirePermissions(Permission.PROJECT_DELETE_OWN) remove(@CurrentUser() user: CoreIdentity, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) { return this.projects.remove(user, id); }
  @Patch(":id/status") @RequirePermissions(Permission.PROJECT_UPDATE_OWN) status(@CurrentUser() user: CoreIdentity, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() dto: StatusDto) { return this.projects.setStatus(user, id, dto.status); }
  @Post(":id/applications") @RequirePermissions(Permission.APPLICATION_CREATE) apply(@CurrentUser() user: CoreIdentity, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() dto: ApplyProjectDto) { return this.projects.apply(user, id, dto); }
  @Post(":id/applications/:applicationId/accept") @RequirePermissions(Permission.APPLICATION_MANAGE_OWN) acceptApplication(@CurrentUser() user: CoreIdentity, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Param("applicationId", new ParseUUIDPipe({ version: "4" })) applicationId: string) { return this.projects.acceptApplication(user, id, applicationId); }
  @Post(":id/applications/:applicationId/reject") @RequirePermissions(Permission.APPLICATION_MANAGE_OWN) rejectApplication(@CurrentUser() user: CoreIdentity, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Param("applicationId", new ParseUUIDPipe({ version: "4" })) applicationId: string) { return this.projects.rejectApplication(user, id, applicationId); }
  @Post(":id/invitations") @RequirePermissions(Permission.INVITATION_CREATE_OWN) invite(@CurrentUser() user: CoreIdentity, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() dto: InviteProjectDto) { return this.projects.invite(user, id, dto); }
  @Post(":id/invitations/:invitationId/accept") @RequirePermissions(Permission.INVITATION_RESPOND_OWN) acceptInvitation(@CurrentUser() user: CoreIdentity, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Param("invitationId", new ParseUUIDPipe({ version: "4" })) invitationId: string) { return this.projects.respondInvitation(user, id, invitationId, true); }
  @Post(":id/invitations/:invitationId/decline") @RequirePermissions(Permission.INVITATION_RESPOND_OWN) declineInvitation(@CurrentUser() user: CoreIdentity, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Param("invitationId", new ParseUUIDPipe({ version: "4" })) invitationId: string) { return this.projects.respondInvitation(user, id, invitationId, false); }
  @Post(":id/follow") @RequirePermissions(Permission.FOLLOW_CREATE) follow(@CurrentUser() user: CoreIdentity, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) { return this.projects.toggleFollow(user, id); }
  @Post(":id/questions") @RequirePermissions(Permission.QUESTION_CREATE) ask(@CurrentUser() user: CoreIdentity, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() dto: AskQuestionDto) { return this.projects.ask(user, id, dto); }
  @Patch(":id/questions/:questionId") @RequirePermissions(Permission.QUESTION_ANSWER_OWN) answer(@CurrentUser() user: CoreIdentity, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Param("questionId", new ParseUUIDPipe({ version: "4" })) questionId: string, @Body() dto: AnswerQuestionDto) { return this.projects.answer(user, id, questionId, dto); }
  @Post(":id/reviews") @RequirePermissions(Permission.REVIEW_CREATE) review(@CurrentUser() user: CoreIdentity, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() dto: ReviewDto) { return this.projects.review(user, id, dto); }
}
