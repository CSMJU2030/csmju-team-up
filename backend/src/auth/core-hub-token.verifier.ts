import { ForbiddenException, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { decodeProtectedHeader, errors, jwtVerify } from "jose";
import { JwksService } from "./jwks.service.js";
import { CORE_ROLE_TO_SUBSYSTEM_ROLE } from "./role-mapping.js";
import type { CoreIdentity } from "./decorators/current-user.js";

const MAX_TOKEN_LIFETIME_SECONDS = 960;

@Injectable()
export class CoreHubTokenVerifier {
  constructor(private readonly config: ConfigService, private readonly jwks: JwksService) {}

  async verify(token: string): Promise<CoreIdentity> {
    let header: ReturnType<typeof decodeProtectedHeader>;
    try {
      header = decodeProtectedHeader(token);
    } catch {
      throw new UnauthorizedException("Invalid access token");
    }
    if (header.alg !== "RS256" || typeof header.kid !== "string" || header.kid.length === 0) {
      throw new UnauthorizedException("Invalid access token");
    }

    let payload: import("jose").JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, this.jwks.getKeySet(), {
        issuer: this.config.getOrThrow<string>("CORE_HUB_ISSUER"),
        audience: this.config.getOrThrow<string>("CORE_HUB_AUDIENCE"),
        algorithms: ["RS256"],
        clockTolerance: Math.min(60, Number(this.config.get<string>("JWT_CLOCK_TOLERANCE_SEC", "5"))),
        requiredClaims: ["sub", "role", "iat", "exp"],
      }));
    } catch (error) {
      if (error instanceof errors.JOSEError) throw new UnauthorizedException("Invalid access token");
      throw new ServiceUnavailableException("Core Hub authentication service unavailable");
    }

    if (typeof payload.sub !== "string" || payload.sub.trim() === "" || typeof payload.role !== "string" || typeof payload.iat !== "number" || typeof payload.exp !== "number") {
      throw new UnauthorizedException("Invalid token claims");
    }
    if (payload.exp - payload.iat > MAX_TOKEN_LIFETIME_SECONDS) throw new UnauthorizedException("Token lifetime exceeds contract");
    if (payload.exp <= Math.floor(Date.now() / 1000) - 60) throw new UnauthorizedException("Access token expired");
    if ("azp" in payload && (typeof payload.azp !== "string" || payload.azp !== this.config.getOrThrow<string>("SUBSYSTEM_ID"))) {
      throw new UnauthorizedException("Token authorized-party mismatch");
    }
    const subsystemRole = CORE_ROLE_TO_SUBSYSTEM_ROLE[payload.role as keyof typeof CORE_ROLE_TO_SUBSYSTEM_ROLE];
    if (!subsystemRole) throw new ForbiddenException("Role is not allowed for this subsystem");

    return {
      coreUserId: payload.sub,
      coreRole: payload.role,
      subsystemRole,
      ...(typeof payload.email === "string" ? { email: payload.email } : {}),
      expiresAt: new Date(payload.exp * 1000).toISOString(),
    };
  }
}
