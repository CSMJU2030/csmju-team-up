import type { components } from "@/api-types";

export type Project = components["schemas"]["Project"];
export type Me = components["schemas"]["Me"];
export type Profile = components["schemas"]["Profile"];
export type Notification = components["schemas"]["Notification"];
export type Conversation = components["schemas"]["Conversation"];
export type ApiErrorBody = { success: false; error: { code: string; message: string; details?: unknown } };

export class ApiException extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = "ApiException";
  }
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (options?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...options, headers, credentials: "include", cache: "no-store" });
  const body = (await response.json().catch(() => ({}))) as Partial<{ success: boolean; data: T; error: { code: string; message: string } }>;
  if (response.status === 401 && typeof window !== "undefined") {
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/auth/login?next=${encodeURIComponent(next)}`);
    throw new ApiException(401, "UNAUTHORIZED", "กรุณาเข้าสู่ระบบ");
  }
  if (!response.ok || body.success === false) {
    const error = body.error;
    throw new ApiException(response.status, error?.code ?? "SERVICE_UNAVAILABLE", error?.message ?? "ไม่สามารถเชื่อมต่อบริการได้");
  }
  return body.data as T;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
