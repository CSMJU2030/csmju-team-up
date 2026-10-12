# TeamUp contribution, progress, and rewards

## Member profiles and contribution passport

Profiles are private, undiscoverable, and hide contribution points by default. Owners explicitly control profile visibility, directory discoverability, contribution visibility, points disclosure, and profile-view counting. Public views contain only verified work; team-only records require a shared project. Core Hub `coreUserId` is the identity key; TeamUp does not maintain usernames or authentication credentials.

Contribution points are awarded only when a reviewer other than the contributor approves submitted work. Project work is reviewable by its owner or members; personal work is reviewable only by staff, lecturers, or administrators. Each ledger entry has a unique event key to prevent duplicate awards.

## Project progress and point rules

Progress is available to project owners and members. Owners create milestones and tasks, assign tasks to members, and review evidence. Only the assigned member can submit a task, and every submission requires an HTTPS evidence URL. Members can update progress and report a blocker; blocker reports notify the project owner. Activity events and task submissions remain visible in the project timeline.

Weighted progress counts only approved completed tasks. Default point values are:

| Event | Default points | Configuration |
|---|---:|---|
| Small / medium / large verified contribution or task | 5 / 10 / 20 | `CONTRIBUTION_POINTS_SMALL`, `CONTRIBUTION_POINTS_MEDIUM`, `CONTRIBUTION_POINTS_LARGE` |
| Completed milestone | 10 | `CONTRIBUTION_POINTS_MILESTONE` |
| Completed project | 25 | `CONTRIBUTION_POINTS_PROJECT` |

Values are validated as integers from 0 to 1000. A task must be assigned and approved with evidence before its assignee qualifies for milestone or project completion points. Unique ledger event keys make milestone and project bonuses idempotent.

## Reward catalog and redemption

The additive `0004_rewards_and_redemptions` migration creates a reward catalog, redemption records, and debit/refund ledger types. Sample catalog records are drafts. `REWARD_CATALOG_MANAGE` and `REWARD_APPROVE` are intentionally excluded from every default role until the department designates owners.

Once explicitly assigned, catalog managers can create draft rewards and fulfill approved requests; approvers can activate drafts and approve/reject requests. Requests reserve points and finite stock transactionally. Rejection or cancellation refunds points and restores stock. The unique redemption event key prevents duplicate point debits.

## API routes

- `GET /api/v1/community/profiles` and `GET /api/v1/community/profiles/:coreUserId`: discoverable directory and privacy-filtered member page
- `GET/POST /api/v1/contributions`, `POST /:id/submit`, `POST /:id/review`, `GET /points/me`: portfolio, evidence, review, and ledger
- `GET /api/v1/projects/:projectId/progress`, milestone/task routes under the project, and task submission/review routes
- `GET /api/v1/rewards`, `POST /:rewardId/redemptions`, `GET /redemptions/me`, and `DELETE /redemptions/:redemptionId`
- `GET /api/v1/rewards/manage` and reward creation/fulfillment require `REWARD_CATALOG_MANAGE`
- `GET /api/v1/rewards/redemptions/pending`, reward activation, and request approval/rejection require `REWARD_APPROVE`

After changing API routes or DTOs, regenerate `openapi.json` and `frontend/src/generated/api.d.ts` with `pnpm generate:api`.
