import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import type { CoreIdentity } from "./decorators/current-user.js";
import { CoreHubTokenVerifier } from "./core-hub-token.verifier.js";

@Injectable()
export class AuthService {
  constructor(private readonly config: ConfigService, private readonly verifier: CoreHubTokenVerifier) {}

  login(next: string | undefined, response: Response): void {
    const safeNext = this.validateNext(next);
    const state = randomBytes(32).toString("base64url");
    const cookieValue = `${state}.${Buffer.from(safeNext, "utf8").toString("base64url")}`;
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.cookie(this.stateCookieName(), cookieValue, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/auth/callback",
      maxAge: 600_000,
    });
    const web = this.config.getOrThrow<string>("CORE_HUB_WEB_URL");
    const subsystem = this.config.getOrThrow<string>("SUBSYSTEM_ID");
    response.redirect(302, `${web}/sso/authorize?subsystem=${encodeURIComponent(subsystem)}&state=${encodeURIComponent(state)}`);
  }

  async callback(request: Request, response: Response): Promise<void> {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Referrer-Policy", "no-referrer");
    const token = typeof request.query.access_token === "string" ? request.query.access_token : undefined;
    const state = typeof request.query.state === "string" ? request.query.state : undefined;
    if (!token) throw new BadRequestException({ code: "BAD_REQUEST", message: "Missing access token" });
    const stateCookie = this.readCookie(request, this.stateCookieName());

    if (!state) {
      response.redirect(302, "/auth/login");
      return;
    }

    response.clearCookie(this.stateCookieName(), { path: "/auth/callback" });
    if (!stateCookie) {
      this.respondStateFailure(request, response, "SSO state cookie missing");
      return;
    }
    const [cookieState, encodedNext] = stateCookie.split(".");
    if (!cookieState || !encodedNext || !this.constantTimeEqual(cookieState, state)) {
      this.respondStateFailure(request, response, "SSO state mismatch");
      return;
    }

    const identity = await this.verifier.verify(token);
    const cookieName = `${this.config.getOrThrow<string>("SUBSYSTEM_ID").replaceAll("-", "_")}_access_token`;
    response.cookie(cookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Math.max(1, identity.expiresAt ? new Date(identity.expiresAt).getTime() - Date.now() : 1),
    });
    response.redirect(302, this.decodeNext(encodedNext));
  }

  logout(response: Response): void {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Referrer-Policy", "no-referrer");
    const cookieName = `${this.config.getOrThrow<string>("SUBSYSTEM_ID").replaceAll("-", "_")}_access_token`;
    response.clearCookie(cookieName, { path: "/" });
    response.clearCookie(this.stateCookieName(), { path: "/auth/callback" });
    response.redirect(303, `${this.config.getOrThrow<string>("CORE_HUB_WEB_URL")}/logout`);
  }

  private validateNext(value: string | undefined): string {
    if (!value) return "/";
    if (value.length > 512 || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
    if ([...value].some((character) => character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127)) return "/";
    try {
      const target = new URL(value, this.config.getOrThrow<string>("APP_BASE_URL"));
      if (target.origin !== this.config.getOrThrow<string>("APP_BASE_URL")) return "/";
    } catch { return "/"; }
    if (value === "/auth" || value.startsWith("/auth/")) return "/";
    return value;
  }

  private respondStateFailure(request: Request, response: Response, message: string): void {
    response.status(401);
    if (request.accepts("html")) {
      response.type("html").send(`<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>เข้าสู่ระบบใหม่ · CS TeamUp</title></head><body style="font-family:system-ui,sans-serif;padding:40px;line-height:1.6"><h1>เซสชันเข้าสู่ระบบหมดอายุ</h1><p>${message}</p><p><a href="/auth/login">เข้าสู่ระบบอีกครั้ง</a></p></body></html>`);
      return;
    }
    throw new UnauthorizedException(message);
  }

  private decodeNext(encoded: string): string {
    try { return this.validateNext(Buffer.from(encoded, "base64url").toString("utf8")); } catch { return "/"; }
  }

  private constantTimeEqual(a: string, b: string): boolean {
    const aa = Buffer.from(a); const bb = Buffer.from(b);
    return aa.length === bb.length && timingSafeEqual(aa, bb);
  }

  private stateCookieName(): string {
    return `${this.config.getOrThrow<string>("SUBSYSTEM_ID").replaceAll("-", "_")}_sso_state`;
  }

  private readCookie(request: Request, name: string): string | undefined {
    const raw = request.header("cookie");
    if (!raw) return undefined;
    for (const chunk of raw.split(";")) {
      const [key, ...rest] = chunk.trim().split("=");
      if (key === name) {
        try { return decodeURIComponent(rest.join("=")); } catch { return undefined; }
      }
    }
    return undefined;
  }
}
