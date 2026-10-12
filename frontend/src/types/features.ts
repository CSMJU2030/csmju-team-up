export type EvidenceKind = "REPOSITORY" | "DEMO" | "DOCUMENT" | "OTHER";

export type MemberDirectoryProfile = {
  coreUserId: string;
  bio: string | null;
  skills: string[];
  githubUrl: string | null;
  linkedinUrl: string | null;
  isAvailable: boolean;
  verifiedContributionCount: number;
  contributions: Array<{ id: string; title: string; role: string; skills: string[]; verifiedAt: string | null }>;
  points?: number;
  isCurrentUser: boolean;
};

export type ContributionEvidence = {
  id: string;
  evidenceType: "REPOSITORY" | "DEMO" | "DOCUMENT" | "OTHER";
  url: string;
  caption: string | null;
  createdAt: string;
};

export type ContributionWork = {
  id: string;
  coreUserId?: string;
  title: string;
  description: string;
  role: string;
  skills: string[];
  workSize: "SMALL" | "MEDIUM" | "LARGE";
  repositoryUrl: string | null;
  demoUrl: string | null;
  status: "DRAFT" | "SUBMITTED" | "VERIFIED" | "REJECTED";
  visibility: "PRIVATE" | "TEAM" | "PUBLIC";
  reviewNote: string | null;
  submittedAt: string | null;
  verifiedAt: string | null;
  evidence: ContributionEvidence[];
  project: { id: string; title: string; status?: string } | null;
  pointTransactions: Array<{ id: string; points: number; reason: string }>;
  createdAt: string;
};

export type PointTransaction = {
  id: string;
  points: number;
  transactionType: "AWARD" | "REVERSAL" | "REDEMPTION" | "REFUND";
  reason: string;
  createdAt: string;
  contribution?: { id: string; title: string; status: string } | null;
};

export type ContributionsMe = { works: ContributionWork[]; points: number; ledger: PointTransaction[] };

export type TaskSubmission = {
  id: string;
  submittedByCoreUserId: string;
  url: string | null;
  note: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewedByCoreUserId: string | null;
  reviewNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
};

export type ProjectTask = {
  id: string;
  projectId: string;
  milestoneId: string | null;
  title: string;
  description: string | null;
  progressNote: string | null;
  blockerNote: string | null;
  assignedCoreUserId: string | null;
  dueAt: string | null;
  workSize: "SMALL" | "MEDIUM" | "LARGE";
  updatedAt: string;
  status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "IN_REVIEW" | "COMPLETED";
  weight: number;
  submissions: TaskSubmission[];
};

export type ProjectMilestone = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED";
  weight: number;
  progressPercent: number;
  tasks: ProjectTask[];
};

export type ProjectProgress = {
  project: { id: string; title: string; status: string; isOwner: boolean; teamMembers: Array<{ coreUserId: string; isOwner: boolean }> };
  progressPercent: number;
  summary: { totalTasks: number; completedTasks: number; blockedTasks: number; reviewTasks: number; overdueTasks: number };
  milestones: ProjectMilestone[];
  tasks: ProjectTask[];
  events: Array<{ id: string; actorCoreUserId: string; entityId: string | null; eventType: string; message: string; createdAt: string }>;
};
