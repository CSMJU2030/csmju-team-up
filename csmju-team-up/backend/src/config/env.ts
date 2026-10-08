const REQUIRED = [
  "DATABASE_URL",
  "CORE_HUB_URL",
  "CORE_HUB_JWKS_URL",
  "CORE_HUB_WEB_URL",
  "CORE_HUB_ISSUER",
  "CORE_HUB_AUDIENCE",
  "SUBSYSTEM_ID",
  "APP_BASE_URL",
] as const;

export function validateEnv(values: Record<string, unknown>) {
  for (const key of REQUIRED) {
    const value = String(values[key] ?? "").trim();
    if (!value) throw new Error(`${key} is required`);
  }
  return values;
}
