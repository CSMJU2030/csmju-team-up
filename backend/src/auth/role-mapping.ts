/** Core Hub role -> TeamUp subsystem role mapping. Keep in sync with registry. */
export const CORE_ROLE_TO_SUBSYSTEM_ROLE = {
  student: "STUDENT",
  alumni: "ALUMNI",
  staff: "STAFF",
  lecturer: "STAFF",
  guest: "GUEST",
  admin: "ADMIN",
} as const;
