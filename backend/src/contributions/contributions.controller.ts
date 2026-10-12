import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { IsArray, IsIn, IsOptional, IsString, IsUrl, MaxLength, MinLength } from "class-validator";
import { CoreHubJwtGuard } from "../auth/guards/core-hub-jwt.guard.js";
import { PermissionsGuard } from "../auth/guards/permissions.guard.js";
import { RequirePermissions } from "../auth/decorators/permissions.js";
import { CurrentUser } from "../auth/decorators/current-user.js";
import type { CoreIdentity } from "../auth/decorators/current-user.js";
import { Permission } from "../auth/permissions.js";
import { ContributionsService, type ContributionVisibility, type EvidenceKind, type WorkSize } from "./contributions.service.js";

class CreateContributionDto {
  @ApiProperty({ minLength: 1, maxLength: 160 }) @IsString() @MinLength(1) @MaxLength(160) title!: string;
  @ApiProperty({ minLength: 1, maxLength: 3000 }) @IsString() @MinLength(1) @MaxLength(3000) description!: string;
  @ApiProperty({ maxLength: 120 }) @IsString() @MaxLength(120) role!: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) skills?: string[];
  @ApiProperty({ enum: ["SMALL", "MEDIUM", "LARGE"] }) @IsIn(["SMALL", "MEDIUM", "LARGE"]) workSize!: WorkSize;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsString() projectId?: string;
  @ApiPropertyOptional({ format: "uri" }) @IsOptional() @IsUrl({ protocols: ["https"], require_protocol: true }) @MaxLength(500) repositoryUrl?: string;
  @ApiPropertyOptional({ format: "uri" }) @IsOptional() @IsUrl({ protocols: ["https"], require_protocol: true }) @MaxLength(500) demoUrl?: string;
  @ApiPropertyOptional({ enum: ["PRIVATE", "TEAM", "PUBLIC"] }) @IsOptional() @IsIn(["PRIVATE", "TEAM", "PUBLIC"]) visibility?: ContributionVisibility;
}
class AddEvidenceDto {
  @ApiProperty({ enum: ["REPOSITORY", "DEMO", "DOCUMENT", "OTHER"] }) @IsIn(["REPOSITORY", "DEMO", "DOCUMENT", "OTHER"]) evidenceType!: EvidenceKind;
  @ApiProperty({ format: "uri", maxLength: 1000 }) @IsUrl({ protocols: ["https"], require_protocol: true }) @MaxLength(1000) url!: string;
  @ApiPropertyOptional({ maxLength: 300 }) @IsOptional() @IsString() @MaxLength(300) caption?: string;
}
class ReviewContributionDto {
  @ApiProperty({ enum: ["APPROVE", "REJECT"] }) @IsIn(["APPROVE", "REJECT"]) decision!: "APPROVE" | "REJECT";
  @ApiPropertyOptional({ maxLength: 1000 }) @IsOptional() @IsString() @MaxLength(1000) reviewNote?: string;
}

@ApiTags("Contributions")
@ApiCookieAuth()
@Controller("v1/contributions")
@UseGuards(CoreHubJwtGuard, PermissionsGuard)
export class ContributionsController {
  constructor(private readonly contributions: ContributionsService) {}

  @Get("review-queue")
  @RequirePermissions(Permission.CONTRIBUTION_REVIEW_PROJECT)
  listReviewQueue(@CurrentUser() user: CoreIdentity) { return this.contributions.listReviewQueue(user); }

  @Get("me")
  @RequirePermissions(Permission.CONTRIBUTION_READ_OWN)
  listMine(@CurrentUser() user: CoreIdentity) { return this.contributions.listMine(user); }

  @Post()
  @RequirePermissions(Permission.CONTRIBUTION_CREATE_OWN)
  create(@CurrentUser() user: CoreIdentity, @Body() dto: CreateContributionDto) { return this.contributions.create(user, dto); }

  @Post(":id/evidence")
  @RequirePermissions(Permission.CONTRIBUTION_CREATE_OWN)
  addEvidence(@CurrentUser() user: CoreIdentity, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() dto: AddEvidenceDto) {
    return this.contributions.addEvidence(user, id, dto);
  }

  @Post(":id/submit")
  @RequirePermissions(Permission.CONTRIBUTION_CREATE_OWN)
  submit(@CurrentUser() user: CoreIdentity, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) { return this.contributions.submit(user, id); }

  @Post(":id/review")
  @RequirePermissions(Permission.CONTRIBUTION_REVIEW_PROJECT)
  review(@CurrentUser() user: CoreIdentity, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() dto: ReviewContributionDto) {
    return this.contributions.review(user, id, dto);
  }

  @Get("points/me")
  @RequirePermissions(Permission.POINTS_READ_OWN)
  points(@CurrentUser() user: CoreIdentity) { return this.contributions.points(user); }
}
