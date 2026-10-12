import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { CoreHubJwtGuard } from "../auth/guards/core-hub-jwt.guard.js";
import { PermissionsGuard } from "../auth/guards/permissions.guard.js";
import { RequirePermissions } from "../auth/decorators/permissions.js";
import { CurrentUser } from "../auth/decorators/current-user.js";
import type { CoreIdentity } from "../auth/decorators/current-user.js";
import { Permission } from "../auth/permissions.js";
import { RewardsService } from "./rewards.service.js";

class CreateRedemptionDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional() @IsString() @MaxLength(500)
  requestNote?: string;
}

class CreateRewardDto {
  @ApiProperty({ minLength: 1, maxLength: 120 })
  @IsString() @MinLength(1) @MaxLength(120)
  name!: string;

  @ApiProperty({ minLength: 1, maxLength: 1000 })
  @IsString() @MinLength(1) @MaxLength(1000)
  description!: string;

  @ApiProperty({ minLength: 1, maxLength: 60 })
  @IsString() @MinLength(1) @MaxLength(60)
  category!: string;

  @ApiProperty({ minimum: 1, maximum: 1000000 })
  @IsInt() @Min(1) @Max(1000000)
  pointCost!: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 1000000, nullable: true })
  @IsOptional() @IsInt() @Min(0) @Max(1000000)
  quantity?: number | null;
}

@ApiTags("Rewards")
@ApiCookieAuth()
@Controller("v1/rewards")
@UseGuards(CoreHubJwtGuard, PermissionsGuard)
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}

  @Get()
  @RequirePermissions(Permission.POINTS_READ_OWN)
  catalog() { return this.rewards.catalog(); }

  @Get("manage")
  @RequirePermissions(Permission.REWARD_CATALOG_MANAGE)
  manageCatalog() { return this.rewards.manageCatalog(); }

  @Post()
  @RequirePermissions(Permission.REWARD_CATALOG_MANAGE)
  createReward(@CurrentUser() user: CoreIdentity, @Body() dto: CreateRewardDto) { return this.rewards.createDraft(user, dto); }

  @Post(":rewardId/activate")
  @RequirePermissions(Permission.REWARD_APPROVE)
  activateReward(@CurrentUser() user: CoreIdentity, @Param("rewardId", new ParseUUIDPipe({ version: "4" })) rewardId: string) {
    return this.rewards.activate(user, rewardId);
  }

  @Get("redemptions/me")
  @RequirePermissions(Permission.POINTS_READ_OWN)
  redemptions(@CurrentUser() user: CoreIdentity) { return this.rewards.redemptions(user); }

  @Get("redemptions/pending")
  @RequirePermissions(Permission.REWARD_APPROVE)
  pendingRedemptions() { return this.rewards.pendingRedemptions(); }

  @Post(":rewardId/redemptions")
  @RequirePermissions(Permission.POINTS_READ_OWN)
  redeem(
    @CurrentUser() user: CoreIdentity,
    @Param("rewardId", new ParseUUIDPipe({ version: "4" })) rewardId: string,
    @Body() dto: CreateRedemptionDto,
  ) {
    return this.rewards.redeem(user, rewardId, dto);
  }

  @Post("redemptions/:redemptionId/approve")
  @RequirePermissions(Permission.REWARD_APPROVE)
  approve(
    @CurrentUser() user: CoreIdentity,
    @Param("redemptionId", new ParseUUIDPipe({ version: "4" })) redemptionId: string,
  ) {
    return this.rewards.review(user, redemptionId, true);
  }

  @Post("redemptions/:redemptionId/reject")
  @RequirePermissions(Permission.REWARD_APPROVE)
  reject(
    @CurrentUser() user: CoreIdentity,
    @Param("redemptionId", new ParseUUIDPipe({ version: "4" })) redemptionId: string,
    @Body() dto: CreateRedemptionDto,
  ) {
    return this.rewards.review(user, redemptionId, false, dto.requestNote);
  }

  @Post("redemptions/:redemptionId/fulfill")
  @RequirePermissions(Permission.REWARD_CATALOG_MANAGE)
  fulfill(
    @CurrentUser() user: CoreIdentity,
    @Param("redemptionId", new ParseUUIDPipe({ version: "4" })) redemptionId: string,
  ) {
    return this.rewards.fulfill(user, redemptionId);
  }

  @Delete("redemptions/:redemptionId")
  @RequirePermissions(Permission.POINTS_READ_OWN)
  cancel(
    @CurrentUser() user: CoreIdentity,
    @Param("redemptionId", new ParseUUIDPipe({ version: "4" })) redemptionId: string,
  ) {
    return this.rewards.cancel(user, redemptionId);
  }
}
