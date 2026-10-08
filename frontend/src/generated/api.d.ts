/**
 * Generated API surface.
 * Regenerate with: pnpm generate:api
 * Source of truth: ../../openapi.json
 */
export interface components {
  schemas: {
    ProjectKind: "COURSE" | "SENIOR_PROJECT" | "PERSONAL_COMPETITION";
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
  };
}

export interface paths {
  [key: string]: unknown;
}
