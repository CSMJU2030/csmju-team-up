import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthService } from "./auth/auth.service.js";
import { SsoCallbackController } from "./auth/sso-callback.controller.js";
import { JwksService } from "./auth/jwks.service.js";
import { CoreHubTokenVerifier } from "./auth/core-hub-token.verifier.js";
import { CoreHubJwtGuard } from "./auth/guards/core-hub-jwt.guard.js";
import { PermissionsGuard } from "./auth/guards/permissions.guard.js";
import { HealthController } from "./health.controller.js";
import { MeController } from "./auth/me.controller.js";
import { PrismaService } from "./common/prisma.service.js";
import { ProjectsController } from "./projects/projects.controller.js";
import { ProjectsService } from "./projects/projects.service.js";
import { ProfileController } from "./profile/profile.controller.js";
import { ProfileService } from "./profile/profile.service.js";
import { MessagesController } from "./projects/messages.controller.js";
import { NotificationsController } from "./notifications.controller.js";
import { validateEnv } from "./config/env.js";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, cache: true, envFilePath: [".env"], validate: validateEnv })],
  controllers: [SsoCallbackController, HealthController, MeController, ProjectsController, ProfileController, MessagesController, NotificationsController],
  providers: [AuthService, JwksService, CoreHubTokenVerifier, CoreHubJwtGuard, PermissionsGuard, PrismaService, ProjectsService, ProfileService],
})
export class AppModule {}
