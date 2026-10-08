import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { CoreHubTokenVerifier } from "../core-hub-token.verifier.js";
import type { CoreIdentity } from "../decorators/current-user.js";

@Injectable()
export class CoreHubJwtGuard implements CanActivate {
  constructor(private readonly verifier: CoreHubTokenVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user: CoreIdentity }>();
    const token = this.readToken(req);
    if (!token) throw new UnauthorizedException("Missing or invalid token");
    req.user = await this.verifier.verify(token);
    return true;
  }

  private readToken(req: Request): string | undefined {
    const authorization = req.header("authorization");
    if (authorization?.startsWith("Bearer ")) return authorization.slice(7).trim() || undefined;
    const rawCookie = req.header("cookie");
    if (!rawCookie) return undefined;
    const cookieName = `${(process.env.SUBSYSTEM_ID ?? "csmju-teamup").replaceAll("-", "_")}_access_token`;
    for (const chunk of rawCookie.split(";")) {
      const [name, ...value] = chunk.trim().split("=");
      if (name === cookieName) {
        try { return decodeURIComponent(value.join("=")); } catch { return undefined; }
      }
    }
    return undefined;
  }
}
