import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsEnum, IsInt, IsOptional, IsPositive, IsString, IsUrl, Max, MaxLength, Min, MinLength } from "class-validator";
import { Type } from "class-transformer";

export enum ProjectKindDto { COURSE = "COURSE", SENIOR_PROJECT = "SENIOR_PROJECT", PERSONAL_COMPETITION = "PERSONAL_COMPETITION" }
export enum ProjectFormatDto { ONLINE = "ONLINE", ONSITE = "ONSITE", HYBRID = "HYBRID" }
export enum ProjectStatusDto { RECRUITING = "RECRUITING", IN_PROGRESS = "IN_PROGRESS", COMPLETED = "COMPLETED" }

export class ListProjectsDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 }) @IsOptional() @Type(() => Number) @IsInt() @IsPositive() page = 1;
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @IsPositive() @Max(100) limit = 20;
  @ApiPropertyOptional({ maxLength: 120 }) @IsOptional() @IsString() @MaxLength(120) q?: string;
  @ApiPropertyOptional({ enum: ProjectKindDto }) @IsOptional() @IsEnum(ProjectKindDto) kind?: ProjectKindDto;
  @ApiPropertyOptional({ enum: ProjectStatusDto }) @IsOptional() @IsEnum(ProjectStatusDto) status?: ProjectStatusDto;
  @ApiPropertyOptional({ enum: ProjectFormatDto }) @IsOptional() @IsEnum(ProjectFormatDto) format?: ProjectFormatDto;
  @ApiPropertyOptional({ maxLength: 80 }) @IsOptional() @IsString() @MaxLength(80) skill?: string;
  @ApiPropertyOptional({ enum: ["true", "false"] }) @IsOptional() @IsString() mine?: string;
}

export class CreateProjectDto {
  @ApiProperty({ minLength: 1, maxLength: 160 }) @IsString() @MinLength(1) @MaxLength(160) title!: string;
  @ApiProperty({ enum: ProjectKindDto }) @IsEnum(ProjectKindDto) kind!: ProjectKindDto;
  @ApiPropertyOptional({ maxLength: 50 }) @IsOptional() @IsString() @MaxLength(50) courseCode?: string;
  @ApiProperty({ minimum: 1, maximum: 100 }) @IsInt() @IsPositive() @Max(100) size!: number;
  @ApiPropertyOptional({ maxLength: 120 }) @IsOptional() @IsString() @MaxLength(120) duration?: string;
  @ApiProperty({ enum: ProjectFormatDto }) @IsEnum(ProjectFormatDto) format!: ProjectFormatDto;
  @ApiProperty({ minLength: 1, maxLength: 4000 }) @IsString() @MinLength(1) @MaxLength(4000) description!: string;
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) roles!: string[];
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) skills!: string[];
  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @MaxLength(500) contactText?: string;
}

export class UpdateProjectDto extends CreateProjectDto {}

export class ApplyProjectDto {
  @ApiPropertyOptional({ maxLength: 120 }) @IsOptional() @IsString() @MaxLength(120) role?: string;
  @ApiPropertyOptional({ maxLength: 1000 }) @IsOptional() @IsString() @MaxLength(1000) message?: string;
}

export class InviteProjectDto {
  @ApiProperty({ minLength: 1, maxLength: 64 }) @IsString() @MinLength(1) @MaxLength(64) inviteeCoreUserId!: string;
  @ApiPropertyOptional({ maxLength: 120 }) @IsOptional() @IsString() @MaxLength(120) role?: string;
}

export class AskQuestionDto {
  @ApiProperty({ minLength: 1, maxLength: 1000 }) @IsString() @MinLength(1) @MaxLength(1000) question!: string;
}

export class AnswerQuestionDto {
  @ApiProperty({ minLength: 1, maxLength: 2000 }) @IsString() @MinLength(1) @MaxLength(2000) answer!: string;
}

export class ReviewDto {
  @ApiProperty({ minLength: 1, maxLength: 64 }) @IsString() @MinLength(1) @MaxLength(64) toCoreUserId!: string;
  @ApiProperty({ minimum: 1, maximum: 5 }) @IsInt() @Min(1) @Max(5) stars!: number;
  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @MaxLength(500) comment?: string;
}

export class MessageDto {
  @IsString() @MinLength(1) @MaxLength(2000) body!: string;
}
