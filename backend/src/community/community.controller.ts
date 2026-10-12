import { Body, Controller, Get, Param, Query, Patch, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { CoreHubJwtGuard } from "../auth/guards/core-hub-jwt.guard.js";
import { PermissionsGuard } from "../auth/guards/permissions.guard.js";
import { RequirePermissions } from "../auth/decorators/permissions.js";
import { CurrentUser } from "../auth/decorators/current-user.js";
import type { CoreIdentity } from "../auth/decorators/current-user.js";
import { Permission } from "../auth/permissions.js";
import { CommunityService } from "./community.service.js";

class DirectoryQueryDto {
  @ApiPropertyOptional({ maxLength: 120 }) @IsOptional() @IsString() @MaxLength(120) q?: string;
  @ApiPropertyOptional({ maxLength: 80 }) @IsOptional() @IsString() @MaxLength(80) skill?: string;
  @ApiPropertyOptional({ minimum: 1, default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20;
}
class UpdatePrivacyDto {
  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @MaxLength(500) bio?: string | null;
  @ApiPropertyOptional({ enum: ["PUBLIC", "TEAM", "PRIVATE"] }) @IsOptional() @IsIn(["PUBLIC", "TEAM", "PRIVATE"]) visibility?: "PUBLIC" | "TEAM" | "PRIVATE";
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDiscoverable?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() showContributionPoints?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() profileViewsEnabled?: boolean;
}

@ApiTags("Community Profiles")
@ApiCookieAuth()
@Controller("v1/community")
@UseGuards(CoreHubJwtGuard, PermissionsGuard)
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get("profiles")
  @RequirePermissions(Permission.PROFILE_READ_DIRECTORY)
  directory(@CurrentUser() user: CoreIdentity, @Query() query: DirectoryQueryDto) { return this.community.directory(user, query); }

  @Get("profiles/:coreUserId")
  @RequirePermissions(Permission.PROFILE_READ_DIRECTORY)
  profile(@CurrentUser() user: CoreIdentity, @Param("coreUserId") coreUserId: string) { return this.community.publicProfile(user, coreUserId); }

  @Patch("profile-settings")
  @RequirePermissions(Permission.PROFILE_PRIVACY_UPDATE_OWN)
  updatePrivacy(@CurrentUser() user: CoreIdentity, @Body() dto: UpdatePrivacyDto) { return this.community.updatePrivacy(user, dto); }

  @Get("profile-views/me")
  @RequirePermissions(Permission.PROFILE_VIEW_HISTORY_READ_OWN)
  profileViews(@CurrentUser() user: CoreIdentity) { return this.community.profileViews(user); }
}
