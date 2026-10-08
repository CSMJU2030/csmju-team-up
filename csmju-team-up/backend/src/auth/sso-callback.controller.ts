import { Controller, Get, Post, Query, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service.js";

@Controller("auth")
export class SsoCallbackController {
  constructor(private readonly auth: AuthService) {}

  @Get("login")
  login(@Query("next") next: string | undefined, @Res() response: Response): void {
    this.auth.login(next, response);
  }

  @Get("callback")
  callback(@Req() request: Request, @Res() response: Response): Promise<void> {
    return this.auth.callback(request, response);
  }

  @Post("logout")
  logout(@Res() response: Response): void {
    this.auth.logout(response);
  }
}
