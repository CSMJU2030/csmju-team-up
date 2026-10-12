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
  for (const key of [
    "CONTRIBUTION_POINTS_SMALL",
    "CONTRIBUTION_POINTS_MEDIUM",
    "CONTRIBUTION_POINTS_LARGE",
    "CONTRIBUTION_POINTS_MILESTONE",
    "CONTRIBUTION_POINTS_PROJECT",
  ]) {
    const configured = values[key];
    if (configured === undefined || String(configured).trim() === "") continue;
    const numeric = Number(configured);
    if (!Number.isSafeInteger(numeric) || numeric < 0 || numeric > 1000) {
      throw new Error(`${key} must be an integer from 0 to 1000`);
    }
  }
  return values;
}
