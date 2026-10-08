import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

export type ApiSuccess<T> = { success: true; data: T; meta?: Record<string, unknown> };

@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<ApiSuccess<unknown> | unknown> {
    return next.handle().pipe(
      map((value) => {
        if (value && typeof value === "object" && "success" in value) return value;
        if (value && typeof value === "object" && "data" in value && "meta" in value) {
          const paged = value as { data: unknown; meta: Record<string, unknown> };
          return { success: true, data: paged.data, meta: paged.meta };
        }
        return { success: true, data: value };
      }),
    );
  }
}
