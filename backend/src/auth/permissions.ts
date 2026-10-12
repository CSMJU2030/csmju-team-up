export enum Permission {
  PROJECT_READ_ANY = "project:read:any",
  PROJECT_CREATE = "project:create",
  PROJECT_UPDATE_OWN = "project:update:own",
  PROJECT_DELETE_OWN = "project:delete:own",
  APPLICATION_CREATE = "application:create",
  APPLICATION_MANAGE_OWN = "application:manage:own",
  INVITATION_CREATE_OWN = "invitation:create:own",
  INVITATION_RESPOND_OWN = "invitation:respond:own",
  FOLLOW_CREATE = "follow:create",
  QUESTION_CREATE = "question:create",
  QUESTION_ANSWER_OWN = "question:answer:own",
  REVIEW_CREATE = "review:create",
  MESSAGE_CREATE = "message:create",
  PROFILE_READ_OWN = "profile:read:own",
  PROFILE_UPDATE_OWN = "profile:update:own",
  PROFILE_READ_DIRECTORY = "profile:read:directory",
  PROFILE_PRIVACY_UPDATE_OWN = "profile:privacy:update:own",
  PROFILE_VIEW_HISTORY_READ_OWN = "profile:view-history:read:own",
  CONTRIBUTION_CREATE_OWN = "contribution:create:own",
  CONTRIBUTION_READ_OWN = "contribution:read:own",
  CONTRIBUTION_REVIEW_PROJECT = "contribution:review:project",
  POINTS_READ_OWN = "points:read:own",
  PROJECT_PROGRESS_READ = "project:progress:read",
  PROJECT_PROGRESS_MANAGE_OWN = "project:progress:manage:own",
  PROJECT_TASK_UPDATE_ASSIGNED = "project:task:update:assigned",
  REWARD_CATALOG_MANAGE = "reward:catalog:manage",
  REWARD_APPROVE = "reward:redemption:approve",
}

const UNASSIGNED_REWARD_PERMISSIONS = new Set([
  Permission.REWARD_CATALOG_MANAGE,
  Permission.REWARD_APPROVE,
]);
const GENERAL_PERMISSIONS = Object.values(Permission).filter((permission) => !UNASSIGNED_REWARD_PERMISSIONS.has(permission));

export const ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
  STUDENT: GENERAL_PERMISSIONS,
  ALUMNI: GENERAL_PERMISSIONS,
  STAFF: GENERAL_PERMISSIONS,
  ADMIN: GENERAL_PERMISSIONS,
  GUEST: [Permission.PROJECT_READ_ANY],
};
