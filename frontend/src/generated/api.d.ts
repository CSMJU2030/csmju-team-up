/**
 * Generated API surface.
 * Regenerate with: pnpm generate:api
 * Source of truth: ../../openapi.json
 */
export interface components {
  schemas: {
    ProjectKind: "COURSE" | "SENIOR_PROJECT" | "PERSONAL_COMPETITION";
    ProjectOrigin: "TEACHER_ASSIGNED" | "SELF_CREATED" | "UNSPECIFIED";
    ProjectScope: "PERSONAL" | "DEPARTMENT" | "UNSPECIFIED";
    CompensationType: "NONE" | "REWARD" | "WAGE";
    ProjectFormat: "ONLINE" | "ONSITE" | "HYBRID";
    ProjectStatus: "RECRUITING" | "IN_PROGRESS" | "COMPLETED";
    ApplicationStatus: "PENDING" | "ACCEPTED" | "REJECTED";
    InvitationStatus: "PENDING" | "ACCEPTED" | "DECLINED";
    ProjectOwner: {
      coreUserId: string;
      isCurrentUser: boolean;
      rating: number | null;
    };
    ProjectMember: {
      id: string;
      coreUserId: string;
      isCurrentUser: boolean;
      role: string;
      message: string | null;
      joinedAt: string;
    };
    ProjectApplication: {
      id: string;
      coreUserId: string;
      isCurrentUser: boolean;
      role: string | null;
      message: string | null;
      status: components["schemas"]["ApplicationStatus"];
      createdAt: string;
    };
    ProjectInvitation: {
      id: string;
      inviteeCoreUserId: string;
      isCurrentUser: boolean;
      role: string | null;
      status: components["schemas"]["InvitationStatus"];
      createdAt: string;
    };
    ProjectQuestion: {
      id: string;
      askerCoreUserId: string;
      isCurrentUser: boolean;
      question: string;
      answer: string | null;
      answeredAt: string | null;
      createdAt: string;
    };
    Project: {
      id: string;
      title: string;
      kind: components["schemas"]["ProjectKind"];
      origin: components["schemas"]["ProjectOrigin"];
      scope: components["schemas"]["ProjectScope"];
      compensationType: components["schemas"]["CompensationType"];
      compensationAmount: number | null;
      courseCode: string | null;
      size: number;
      duration: string | null;
      format: components["schemas"]["ProjectFormat"];
      description: string;
      status: components["schemas"]["ProjectStatus"];
      contactText: string | null;
      createdAt: string;
      updatedAt: string;
      owner: components["schemas"]["ProjectOwner"];
      roles: string[];
      skills: string[];
      members: components["schemas"]["ProjectMember"][];
      applications: components["schemas"]["ProjectApplication"][];
      invitations: components["schemas"]["ProjectInvitation"][];
      questions: components["schemas"]["ProjectQuestion"][];
      reviews: Array<{
        id: string;
        fromCoreUserId: string;
        toCoreUserId: string;
        stars: number;
        comment: string | null;
        createdAt: string;
      }>;
      isFollowing: boolean;
      acceptedCount: number;
      remainingSlots: number;
      currentApplication: { id: string; status: components["schemas"]["ApplicationStatus"] } | null;
      currentInvitation: { id: string; role: string | null; status: components["schemas"]["InvitationStatus"] } | null;
    };
    Me: {
      coreUserId: string;
      coreRole: string;
      subsystemRole: string;
      email?: string;
      session: { expiresAt: string };
    };
    PortfolioItem: {
      id: string;
      imageId: string;
      caption: string | null;
    };
    Profile: {
      id: string;
      coreUserId: string;
      skills: string[];
      githubUrl: string | null;
      linkedinUrl: string | null;
      contactText: string | null;
      isAvailable: boolean;
      portfolio: components["schemas"]["PortfolioItem"][];
    } | null;
    Notification: {
      id: string;
      type: string;
      projectId?: string;
      actorCoreUserId?: string;
      message: string;
      isRead: boolean;
      createdAt: string;
    };
    ConversationParticipant: { coreUserId: string };
    Message: {
      id: string;
      conversationId: string;
      senderCoreUserId: string;
      body: string;
      createdAt: string;
    };
    Conversation: {
      id: string;
      participants: components["schemas"]["ConversationParticipant"][];
      messages: components["schemas"]["Message"][];
    };
    UpdatePrivacyDto: { bio?: string | null; visibility?: "PUBLIC" | "TEAM" | "PRIVATE"; isDiscoverable?: boolean; showContributionPoints?: boolean; profileViewsEnabled?: boolean };
    CreateContributionDto: { title: string; description: string; role: string; skills?: string[]; workSize: "SMALL" | "MEDIUM" | "LARGE"; projectId?: string; repositoryUrl?: string; demoUrl?: string; visibility?: "PRIVATE" | "TEAM" | "PUBLIC" };
    AddEvidenceDto: { evidenceType: "REPOSITORY" | "DEMO" | "DOCUMENT" | "OTHER"; url: string; caption?: string };
    ReviewContributionDto: { decision: "APPROVE" | "REJECT"; reviewNote?: string };
    CreateMilestoneDto: { title: string; description?: string; dueAt?: string; weight?: number };
    UpdateMilestoneDto: { title?: string; description?: string | null; dueAt?: string | null; status?: "TODO" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED"; weight?: number };
    CreateTaskDto: { title: string; description?: string; milestoneId?: string; assignedCoreUserId?: string; dueAt?: string; workSize: "SMALL" | "MEDIUM" | "LARGE"; weight?: number };
    UpdateTaskDto: { title?: string; description?: string | null; progressNote?: string | null; blockerNote?: string | null; assignedCoreUserId?: string | null; dueAt?: string | null; status?: "TODO" | "IN_PROGRESS" | "BLOCKED"; weight?: number };
    TaskSubmissionDto: { url: string; note: string };
    ReviewTaskSubmissionDto: { decision: "APPROVE" | "REJECT"; reviewNote?: string };
    CreateRewardDto: { name: string; description: string; category: string; pointCost: number; quantity?: number | null };
    CreateRedemptionDto: { requestNote?: string };
  };
}

export interface paths {
  [key: string]: unknown;
}
