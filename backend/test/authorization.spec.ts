import { ForbiddenException } from "@nestjs/common";
import { jest } from "@jest/globals";
import { ProjectsService } from "../src/projects/projects.service.js";
import type { CoreIdentity } from "../src/auth/decorators/current-user.js";

describe("Project authorization", () => {
  it("rejects a non-owner from deleting a project", async () => {
    const prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue({ coreUserId: "owner-001" }),
        delete: jest.fn(),
      },
    };
    const service = new ProjectsService(prisma as never);
    const otherUser: CoreIdentity = {
      coreUserId: "other-001",
      coreRole: "student",
      subsystemRole: "STUDENT",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };

    await expect(service.remove(otherUser, "00000000-0000-4000-8000-000000000001"))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.project.delete).not.toHaveBeenCalled();
  });
});
