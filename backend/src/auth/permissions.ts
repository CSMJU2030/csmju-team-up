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
}

export const ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
  STUDENT: Object.values(Permission),
  ALUMNI: Object.values(Permission),
  STAFF: Object.values(Permission),
  ADMIN: Object.values(Permission),
  GUEST: [Permission.PROJECT_READ_ANY],
};
