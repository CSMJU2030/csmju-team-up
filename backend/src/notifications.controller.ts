import { PermissionsGuard } from "./auth/guards/permissions.guard.js";
import { RequirePermissions } from "./auth/decorators/permissions.js";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from "@nestjs/common";
import { CoreHubJwtGuard } from "./auth/guards/core-hub-jwt.guard.js";
import { CurrentUser } from "./auth/decorators/current-user.js";
import type { CoreIdentity } from "./auth/decorators/current-user.js";
import { Permission } from "./auth/permissions.js";
import { ProjectsService } from "./projects/projects.service.js";

@ApiTags("Notifications")
@ApiCookieAuth()
@Controller("v1/notifications")
@UseGuards(CoreHubJwtGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private readonly projects: ProjectsService) {}
  @Get()
  @RequirePermissions(Permission.PROJECT_READ_ANY)
  list(@CurrentUser() user: CoreIdentity) { return this.projects.notifications(user); }
  @Patch(":id/read")
  @RequirePermissions(Permission.PROJECT_READ_ANY)
  read(@CurrentUser() user: CoreIdentity, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) { return this.projects.readNotification(user, id); }
}
