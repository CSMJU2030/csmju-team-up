import { SetMetadata } from "@nestjs/common";

export const REQUIRE_PERMISSIONS = "required_permissions";
export const RequirePermissions = (...permissions: string[]) => SetMetadata(REQUIRE_PERMISSIONS, permissions);
