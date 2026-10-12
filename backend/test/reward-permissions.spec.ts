import { Permission, ROLE_PERMISSIONS } from "../src/auth/permissions.js";

describe("reward approval permissions", () => {
  it("keeps catalog management and redemption approval unassigned until the department appoints owners", () => {
    for (const permissions of Object.values(ROLE_PERMISSIONS)) {
      expect(permissions).not.toContain(Permission.REWARD_CATALOG_MANAGE);
      expect(permissions).not.toContain(Permission.REWARD_APPROVE);
    }
  });
});
