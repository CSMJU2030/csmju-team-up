-- Add opt-in discoverable profiles and contribution/workflow records.
-- Existing profiles remain PRIVATE and not discoverable by default.
CREATE TYPE "ProfileVisibility" AS ENUM ('PUBLIC', 'TEAM', 'PRIVATE');
CREATE TYPE "ContributionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'VERIFIED', 'REJECTED');
CREATE TYPE "ContributionVisibility" AS ENUM ('PRIVATE', 'TEAM', 'PUBLIC');
CREATE TYPE "ContributionWorkSize" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');
CREATE TYPE "ContributionEvidenceType" AS ENUM ('REPOSITORY', 'DEMO', 'DOCUMENT', 'OTHER');
CREATE TYPE "PointTransactionType" AS ENUM ('AWARD', 'REVERSAL', 'REDEMPTION', 'REFUND');
CREATE TYPE "ProjectMilestoneStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'COMPLETED');
CREATE TYPE "ProjectTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'COMPLETED');
CREATE TYPE "TaskSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "collaboration_profiles"
  ADD COLUMN "bio" TEXT,
  ADD COLUMN "visibility" "ProfileVisibility" NOT NULL DEFAULT 'PRIVATE',
  ADD COLUMN "is_discoverable" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "show_contribution_points" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "profile_views_enabled" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE "profile_view_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "viewer_core_user_id" VARCHAR(64) NOT NULL,
  "viewed_core_user_id" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "profile_view_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "profile_view_events_viewed_core_user_id_fkey" FOREIGN KEY ("viewed_core_user_id") REFERENCES "collaboration_profiles"("core_user_id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "profile_view_events_viewed_core_user_id_created_at_idx" ON "profile_view_events"("viewed_core_user_id", "created_at");
CREATE INDEX "profile_view_events_viewer_core_user_id_viewed_core_user_id_created_at_idx" ON "profile_view_events"("viewer_core_user_id", "viewed_core_user_id", "created_at");

CREATE TABLE "contribution_works" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "core_user_id" VARCHAR(64) NOT NULL,
  "project_id" UUID,
  "title" VARCHAR(160) NOT NULL,
  "description" VARCHAR(3000) NOT NULL,
  "role" VARCHAR(120) NOT NULL,
  "skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "work_size" "ContributionWorkSize" NOT NULL DEFAULT 'SMALL',
  "repository_url" VARCHAR(500),
  "demo_url" VARCHAR(500),
  "status" "ContributionStatus" NOT NULL DEFAULT 'DRAFT',
  "visibility" "ContributionVisibility" NOT NULL DEFAULT 'PRIVATE',
  "review_note" VARCHAR(1000),
  "submitted_at" TIMESTAMPTZ(3),
  "verified_by_core_user_id" VARCHAR(64),
  "verified_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contribution_works_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contribution_works_core_user_id_fkey" FOREIGN KEY ("core_user_id") REFERENCES "collaboration_profiles"("core_user_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "contribution_works_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "contribution_works_non_empty_title_check" CHECK (length(trim("title")) > 0)
);
CREATE INDEX "contribution_works_core_user_id_created_at_idx" ON "contribution_works"("core_user_id", "created_at");
CREATE INDEX "contribution_works_project_id_status_idx" ON "contribution_works"("project_id", "status");
CREATE INDEX "contribution_works_visibility_status_idx" ON "contribution_works"("visibility", "status");

CREATE TABLE "contribution_evidence" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "contribution_id" UUID NOT NULL,
  "evidence_type" "ContributionEvidenceType" NOT NULL DEFAULT 'OTHER',
  "url" VARCHAR(1000) NOT NULL,
  "caption" VARCHAR(300),
  "created_by_core_user_id" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contribution_evidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contribution_evidence_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "contribution_works"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "contribution_evidence_contribution_id_created_at_idx" ON "contribution_evidence"("contribution_id", "created_at");

CREATE TABLE "contribution_point_transactions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "core_user_id" VARCHAR(64) NOT NULL,
  "contribution_id" UUID,
  "points" INTEGER NOT NULL,
  "transaction_type" "PointTransactionType" NOT NULL,
  "reason" VARCHAR(300) NOT NULL,
  "event_key" VARCHAR(200) NOT NULL,
  "created_by_core_user_id" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contribution_point_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contribution_point_transactions_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "contribution_works"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "contribution_point_transactions_event_key_key" UNIQUE ("event_key"),
  CONSTRAINT "contribution_point_transactions_nonzero_points_check" CHECK ("points" <> 0)
);
CREATE INDEX "contribution_point_transactions_core_user_id_created_at_idx" ON "contribution_point_transactions"("core_user_id", "created_at");
CREATE INDEX "contribution_point_transactions_contribution_id_idx" ON "contribution_point_transactions"("contribution_id");

CREATE TABLE "project_milestones" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "description" VARCHAR(2000),
  "due_at" TIMESTAMPTZ(3),
  "status" "ProjectMilestoneStatus" NOT NULL DEFAULT 'TODO',
  "weight" INTEGER NOT NULL DEFAULT 1,
  "created_by_core_user_id" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_milestones_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_milestones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "project_milestones_weight_positive_check" CHECK ("weight" BETWEEN 1 AND 100)
);
CREATE INDEX "project_milestones_project_id_status_idx" ON "project_milestones"("project_id", "status");

CREATE TABLE "project_tasks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL,
  "milestone_id" UUID,
  "title" VARCHAR(160) NOT NULL,
  "description" VARCHAR(2000),
  "progress_note" VARCHAR(2000),
  "blocker_note" VARCHAR(1000),
  "assigned_core_user_id" VARCHAR(64),
  "due_at" TIMESTAMPTZ(3),
  "status" "ProjectTaskStatus" NOT NULL DEFAULT 'TODO',
  "work_size" "ContributionWorkSize" NOT NULL DEFAULT 'SMALL',
  "weight" INTEGER NOT NULL DEFAULT 1,
  "created_by_core_user_id" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_tasks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "project_tasks_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "project_milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "project_tasks_weight_positive_check" CHECK ("weight" BETWEEN 1 AND 100)
);
CREATE INDEX "project_tasks_project_id_status_idx" ON "project_tasks"("project_id", "status");
CREATE INDEX "project_tasks_assigned_core_user_id_status_idx" ON "project_tasks"("assigned_core_user_id", "status");
CREATE INDEX "project_tasks_milestone_id_idx" ON "project_tasks"("milestone_id");

CREATE TABLE "project_progress_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL,
  "actor_core_user_id" VARCHAR(64) NOT NULL,
  "entity_id" UUID,
  "event_type" VARCHAR(40) NOT NULL,
  "message" VARCHAR(500) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_progress_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_progress_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "project_progress_events_project_id_created_at_idx" ON "project_progress_events"("project_id", "created_at");
CREATE INDEX "project_progress_events_entity_id_created_at_idx" ON "project_progress_events"("entity_id", "created_at");

CREATE TABLE "task_submissions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "task_id" UUID NOT NULL,
  "submitted_by_core_user_id" VARCHAR(64) NOT NULL,
  "url" VARCHAR(1000),
  "note" VARCHAR(2000) NOT NULL,
  "status" "TaskSubmissionStatus" NOT NULL DEFAULT 'PENDING',
  "reviewed_by_core_user_id" VARCHAR(64),
  "review_note" VARCHAR(1000),
  "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" TIMESTAMPTZ(3),
  CONSTRAINT "task_submissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "task_submissions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "project_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "task_submissions_task_id_status_idx" ON "task_submissions"("task_id", "status");
CREATE INDEX "task_submissions_submitted_by_core_user_id_submitted_at_idx" ON "task_submissions"("submitted_by_core_user_id", "submitted_at");
