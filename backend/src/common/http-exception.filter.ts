import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Request, Response } from "express";

const statusToCode: Record<number, string> = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  429: "TOO_MANY_REQUESTS",
  503: "SERVICE_UNAVAILABLE",
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const code = statusToCode[status] ?? "INTERNAL_ERROR";
    let message = "เกิดข้อผิดพลาดจากระบบ";
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === "object" && body !== null) {
        const candidate = body as { message?: string | string[]; details?: unknown; code?: string };
        if (candidate.code && /^[A-Z][A-Z0-9_]*$/.test(candidate.code)) code = candidate.code;
        if (candidate.message) {
          if (Array.isArray(candidate.message)) { message = "ข้อมูลไม่ผ่านการตรวจสอบ"; details = candidate.message; }
          else message = candidate.message;
        }
        if (candidate.details) details = candidate.details;
      } else if (typeof body === "string") {
        message = body;
      }
    }

    if (status === 429 || status === 503) response.setHeader("Retry-After", "30");
    response.setHeader("Cache-Control", request.path.startsWith("/auth/") ? "no-store" : "no-cache");
    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    });
  }
}
