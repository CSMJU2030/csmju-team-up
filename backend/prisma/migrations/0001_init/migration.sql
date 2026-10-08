
CREATE TYPE "ProjectKind" AS ENUM ('COURSE', 'SENIOR_PROJECT', 'PERSONAL_COMPETITION');
CREATE TYPE "ProjectFormat" AS ENUM ('ONLINE', 'ONSITE', 'HYBRID');
CREATE TYPE "ProjectStatus" AS ENUM ('RECRUITING', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

CREATE TABLE "collaboration_profiles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "core_user_id" VARCHAR(64) NOT NULL,
  "skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "github_url" TEXT,
  "linkedin_url" TEXT,
  "contact_text" TEXT,
  "is_available" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "collaboration_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "collaboration_profiles_core_user_id_key" ON "collaboration_profiles"("core_user_id");

CREATE TABLE "portfolio_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "core_user_id" VARCHAR(64) NOT NULL,
  "image_id" VARCHAR(128) NOT NULL,
  "caption" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "portfolio_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "portfolio_items_core_user_id_fkey" FOREIGN KEY ("core_user_id") REFERENCES "collaboration_profiles"("core_user_id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "portfolio_items_core_user_id_idx" ON "portfolio_items"("core_user_id");

CREATE TABLE "projects" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "core_user_id" VARCHAR(64) NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "kind" "ProjectKind" NOT NULL,
  "course_code" VARCHAR(50),
  "size" INTEGER NOT NULL,
  "duration" VARCHAR(120),
  "format" "ProjectFormat" NOT NULL,
  "description" TEXT NOT NULL,
  "status" "ProjectStatus" NOT NULL DEFAULT 'RECRUITING',
  "contact_text" VARCHAR(500),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "projects_core_user_id_idx" ON "projects"("core_user_id");
CREATE INDEX "projects_status_idx" ON "projects"("status");
CREATE INDEX "projects_kind_idx" ON "projects"("kind");
ALTER TABLE "projects" ADD CONSTRAINT "projects_size_positive_check" CHECK ("size" > 0);

CREATE TABLE "project_roles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL,
  "role" VARCHAR(120) NOT NULL,
  CONSTRAINT "project_roles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_roles_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "project_roles_project_id_idx" ON "project_roles"("project_id");

CREATE TABLE "project_skills" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL,
  "skill" VARCHAR(80) NOT NULL,
  CONSTRAINT "project_skills_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_skills_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "project_skills_project_id_idx" ON "project_skills"("project_id");
CREATE INDEX "project_skills_skill_idx" ON "project_skills"("skill");

CREATE TABLE "project_members" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL,
  "core_user_id" VARCHAR(64) NOT NULL,
  "role" VARCHAR(120) NOT NULL,
  "message" VARCHAR(1000),
  "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "project_members_project_id_core_user_id_key" ON "project_members"("project_id", "core_user_id");
CREATE INDEX "project_members_core_user_id_idx" ON "project_members"("core_user_id");

CREATE TABLE "project_applications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL,
  "core_user_id" VARCHAR(64) NOT NULL,
  "role" VARCHAR(120),
  "message" VARCHAR(1000),
  "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_applications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_applications_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "project_applications_project_id_core_user_id_key" ON "project_applications"("project_id", "core_user_id");
CREATE INDEX "project_applications_core_user_id_idx" ON "project_applications"("core_user_id");

CREATE TABLE "project_invitations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL,
  "invitee_core_user_id" VARCHAR(64) NOT NULL,
  "role" VARCHAR(120),
  "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_invitations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_invitations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "project_invitations_project_id_invitee_core_user_id_key" ON "project_invitations"("project_id", "invitee_core_user_id");
CREATE INDEX "project_invitations_invitee_core_user_id_idx" ON "project_invitations"("invitee_core_user_id");

CREATE TABLE "project_follows" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL,
  "core_user_id" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_follows_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_follows_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "project_follows_project_id_core_user_id_key" ON "project_follows"("project_id", "core_user_id");
CREATE INDEX "project_follows_core_user_id_idx" ON "project_follows"("core_user_id");

CREATE TABLE "project_questions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL,
  "asker_core_user_id" VARCHAR(64) NOT NULL,
  "question" VARCHAR(1000) NOT NULL,
  "answer" VARCHAR(2000),
  "answered_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_questions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_questions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "project_questions_project_id_idx" ON "project_questions"("project_id");
CREATE INDEX "project_questions_asker_core_user_id_idx" ON "project_questions"("asker_core_user_id");

CREATE TABLE "project_reviews" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL,
  "from_core_user_id" VARCHAR(64) NOT NULL,
  "to_core_user_id" VARCHAR(64) NOT NULL,
  "stars" INTEGER NOT NULL,
  "comment" VARCHAR(500),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_reviews_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "project_reviews_project_id_from_core_user_id_to_core_user_id_key" ON "project_reviews"("project_id", "from_core_user_id", "to_core_user_id");
CREATE INDEX "project_reviews_to_core_user_id_idx" ON "project_reviews"("to_core_user_id");
ALTER TABLE "project_reviews" ADD CONSTRAINT "project_reviews_stars_range_check" CHECK ("stars" BETWEEN 1 AND 5);

CREATE TABLE "conversations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversation_participants" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id" UUID NOT NULL,
  "core_user_id" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "conversation_participants_conversation_id_core_user_id_key" ON "conversation_participants"("conversation_id", "core_user_id");
CREATE INDEX "conversation_participants_core_user_id_idx" ON "conversation_participants"("core_user_id");

CREATE TABLE "messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id" UUID NOT NULL,
  "sender_core_user_id" VARCHAR(64) NOT NULL,
  "body" VARCHAR(2000) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");
CREATE INDEX "messages_sender_core_user_id_idx" ON "messages"("sender_core_user_id");

CREATE TABLE "notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "core_user_id" VARCHAR(64) NOT NULL,
  "type" VARCHAR(64) NOT NULL,
  "project_id" UUID,
  "actor_core_user_id" VARCHAR(64),
  "message" VARCHAR(500) NOT NULL,
  "is_read" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notifications_core_user_id_is_read_created_at_idx" ON "notifications"("core_user_id", "is_read", "created_at");
CREATE INDEX "notifications_project_id_idx" ON "notifications"("project_id");

-- Atomic capacity protection for acceptance is implemented in the service layer by locking the project row.
