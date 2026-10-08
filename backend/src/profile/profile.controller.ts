import { PermissionsGuard } from "../auth/guards/permissions.guard.js";
import { RequirePermissions } from "../auth/decorators/permissions.js";
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsOptional, IsString, IsUrl, MaxLength } from "class-validator";
import { CoreHubJwtGuard } from "../auth/guards/core-hub-jwt.guard.js";
import { Permission } from "../auth/permissions.js";
import { CurrentUser } from "../auth/decorators/current-user.js";
import type { CoreIdentity } from "../auth/decorators/current-user.js";
import { ProfileService } from "./profile.service.js";

class UpdateProfileDto {
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) skills!: string[];
  @ApiPropertyOptional({ format: "uri", maxLength: 500 }) @IsOptional() @IsUrl() @MaxLength(500) githubUrl?: string;
  @ApiPropertyOptional({ format: "uri", maxLength: 500 }) @IsOptional() @IsUrl() @MaxLength(500) linkedinUrl?: string;
  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @MaxLength(500) contactText?: string;
  @ApiProperty() @IsBoolean() isAvailable!: boolean;
}
class AddPortfolioDto {
  @ApiProperty({ maxLength: 128 }) @IsString() imageId!: string;
  @ApiPropertyOptional({ maxLength: 200 }) @IsOptional() @IsString() @MaxLength(200) caption?: string;
}

@ApiTags("Profile")
@ApiCookieAuth()
@Controller("v1/profile")
@UseGuards(CoreHubJwtGuard, PermissionsGuard)
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  @RequirePermissions(Permission.PROFILE_READ_OWN)
  get(@CurrentUser() user: CoreIdentity) { return this.profile.get(user); }

  @Patch()
  @RequirePermissions(Permission.PROFILE_UPDATE_OWN)
  update(@CurrentUser() user: CoreIdentity, @Body() dto: UpdateProfileDto) { return this.profile.upsert(user, dto); }

  @Post("portfolio")
  @RequirePermissions(Permission.PROFILE_UPDATE_OWN)
  addPortfolio(@CurrentUser() user: CoreIdentity, @Body() dto: AddPortfolioDto) { return this.profile.addPortfolio(user, dto); }

  @Delete("portfolio/:id")
  @RequirePermissions(Permission.PROFILE_UPDATE_OWN)
  deletePortfolio(@CurrentUser() user: CoreIdentity, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) { return this.profile.deletePortfolio(user, id); }
}
