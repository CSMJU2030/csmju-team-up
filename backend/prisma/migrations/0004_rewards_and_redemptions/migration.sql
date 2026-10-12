CREATE TYPE "RewardStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "RewardRedemptionStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'FULFILLED', 'CANCELLED');

CREATE TABLE "reward_catalog" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(120) NOT NULL,
  "description" VARCHAR(1000) NOT NULL,
  "category" VARCHAR(60) NOT NULL,
  "point_cost" INTEGER NOT NULL,
  "remaining_quantity" INTEGER,
  "status" "RewardStatus" NOT NULL DEFAULT 'DRAFT',
  "created_by_core_user_id" VARCHAR(64),
  "activated_by_core_user_id" VARCHAR(64),
  "activated_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reward_catalog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reward_catalog_point_cost_check" CHECK ("point_cost" > 0),
  CONSTRAINT "reward_catalog_remaining_quantity_check" CHECK ("remaining_quantity" IS NULL OR "remaining_quantity" >= 0)
);
CREATE INDEX "reward_catalog_status_category_idx" ON "reward_catalog"("status", "category");

CREATE TABLE "reward_redemptions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "reward_id" UUID NOT NULL,
  "core_user_id" VARCHAR(64) NOT NULL,
  "status" "RewardRedemptionStatus" NOT NULL DEFAULT 'REQUESTED',
  "point_cost" INTEGER NOT NULL,
  "request_note" VARCHAR(500),
  "review_note" VARCHAR(500),
  "reviewed_by_core_user_id" VARCHAR(64),
  "reviewed_at" TIMESTAMPTZ(3),
  "fulfilled_at" TIMESTAMPTZ(3),
  "fulfilled_by_core_user_id" VARCHAR(64),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reward_redemptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reward_redemptions_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "reward_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "reward_redemptions_point_cost_check" CHECK ("point_cost" > 0)
);
CREATE INDEX "reward_redemptions_core_user_id_status_created_at_idx" ON "reward_redemptions"("core_user_id", "status", "created_at");
CREATE INDEX "reward_redemptions_reward_id_status_idx" ON "reward_redemptions"("reward_id", "status");

ALTER TABLE "contribution_point_transactions"
  ADD COLUMN "redemption_id" UUID,
  ADD CONSTRAINT "contribution_point_transactions_redemption_id_fkey"
    FOREIGN KEY ("redemption_id") REFERENCES "reward_redemptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "contribution_point_transactions_redemption_id_key"
  ON "contribution_point_transactions"("redemption_id");

-- Catalog entries remain drafts until the department assigns an authorized approver.
INSERT INTO "reward_catalog" ("name", "description", "category", "point_cost", "status")
VALUES
  ('CS TeamUp Sticker Pack', 'ตัวอย่างรางวัลสำหรับทดสอบระบบแลกแต้ม', 'MERCHANDISE', 50, 'DRAFT'),
  ('Mentor Session', 'ตัวอย่างสิทธิ์เข้าร่วม session ให้คำปรึกษา', 'EXPERIENCE', 100, 'DRAFT');
