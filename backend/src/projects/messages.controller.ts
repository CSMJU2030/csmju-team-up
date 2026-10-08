import { PermissionsGuard } from "../auth/guards/permissions.guard.js";
import { RequirePermissions } from "../auth/decorators/permissions.js";
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiProperty, ApiTags } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";
import { CoreHubJwtGuard } from "../auth/guards/core-hub-jwt.guard.js";
import { CurrentUser } from "../auth/decorators/current-user.js";
import type { CoreIdentity } from "../auth/decorators/current-user.js";
import { Permission } from "../auth/permissions.js";
import { ProjectsService } from "./projects.service.js";

class CreateConversationDto { @ApiProperty({ minLength: 1, maxLength: 64 }) @IsString() @MinLength(1) @MaxLength(64) otherCoreUserId!: string; }
class MessageDto { @ApiProperty({ minLength: 1, maxLength: 2000 }) @IsString() @MinLength(1) @MaxLength(2000) body!: string; }

@ApiTags("Conversations")
@ApiCookieAuth()
@Controller("v1/conversations")
@UseGuards(CoreHubJwtGuard, PermissionsGuard)
export class MessagesController {
  constructor(private readonly projects: ProjectsService) {}
  @Get()
  @RequirePermissions(Permission.MESSAGE_CREATE)
  list(@CurrentUser() user: CoreIdentity) { return this.projects.conversations(user); }
  @Post()
  @RequirePermissions(Permission.MESSAGE_CREATE)
  create(@CurrentUser() user: CoreIdentity, @Body() dto: CreateConversationDto) { return this.projects.conversation(user, dto.otherCoreUserId); }
  @Get(":id/messages")
  @RequirePermissions(Permission.MESSAGE_CREATE)
  messages(@CurrentUser() user: CoreIdentity, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) { return this.projects.messages(user, id); }
  @Post(":id/messages")
  @RequirePermissions(Permission.MESSAGE_CREATE)
  send(@CurrentUser() user: CoreIdentity, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() dto: MessageDto) { return this.projects.sendMessage(user, id, dto); }
}
