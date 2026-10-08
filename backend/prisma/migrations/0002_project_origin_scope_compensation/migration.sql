CREATE TYPE "ProjectOrigin" AS ENUM ('TEACHER_ASSIGNED', 'SELF_CREATED', 'UNSPECIFIED');
CREATE TYPE "ProjectScope" AS ENUM ('PERSONAL', 'DEPARTMENT', 'UNSPECIFIED');
CREATE TYPE "CompensationType" AS ENUM ('NONE', 'REWARD', 'WAGE');

ALTER TABLE "projects"
  ADD COLUMN "origin" "ProjectOrigin" NOT NULL DEFAULT 'UNSPECIFIED',
  ADD COLUMN "scope" "ProjectScope" NOT NULL DEFAULT 'UNSPECIFIED',
  ADD COLUMN "compensation_type" "CompensationType" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "compensation_amount" INTEGER;

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_compensation_amount_positive_check"
  CHECK ("compensation_amount" IS NULL OR "compensation_amount" > 0);