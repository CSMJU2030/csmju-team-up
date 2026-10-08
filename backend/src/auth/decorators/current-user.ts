import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

export type CoreIdentity = {
  coreUserId: string;
  coreRole: string;
  subsystemRole: string;
  email?: string;
  expiresAt: string;
};

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): CoreIdentity => {
  return context.switchToHttp().getRequest<Request & { user: CoreIdentity }>().user;
});
