import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLE_PERMISSIONS } from "../permissions.js";
import { REQUIRE_PERMISSIONS } from "../decorators/permissions.js";
import type { CoreIdentity } from "../decorators/current-user.js";
import type { Request } from "express";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRE_PERMISSIONS, [context.getHandler(), context.getClass()]) ?? [];
    if (!required.length) return true;
    const user = context.switchToHttp().getRequest<Request & { user: CoreIdentity }>().user;
    const allowed = ROLE_PERMISSIONS[user?.subsystemRole] ?? [];
    if (required.every((permission) => allowed.includes(permission as never))) return true;
    throw new ForbiddenException("You do not have permission to perform this action");
  }
}
