import { PermissionsGuard } from "./guards/permissions.guard.js";
import { RequirePermissions } from "./decorators/permissions.js";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { Controller, Get, UseGuards } from "@nestjs/common";
import { CoreHubJwtGuard } from "./guards/core-hub-jwt.guard.js";
import { CurrentUser } from "./decorators/current-user.js";
import type { CoreIdentity } from "./decorators/current-user.js";

@ApiTags("Me")
@ApiCookieAuth()
@Controller("v1/me")
@UseGuards(CoreHubJwtGuard, PermissionsGuard)
export class MeController {
  @Get()
  getMe(@CurrentUser() user: CoreIdentity) {
    return {
      coreUserId: user.coreUserId,
      coreRole: user.coreRole,
      subsystemRole: user.subsystemRole,
      email: user.email,
      session: { expiresAt: user.expiresAt },
    };
  }
}
