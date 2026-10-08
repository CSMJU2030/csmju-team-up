# Test Results — 2026-10-08

## Static standards

**20/20 compliance jobs returned exit code 0** using the supplied Standards 1.8.4 checker.

Two groups are internally skipped because this environment has no pnpm/dependency installation:

- `API-01` OpenAPI regeneration check
- `QA-01..04` lint/typecheck/test/build checks

The job itself returns success for those checks because the standard intentionally treats missing tooling as a local skip; this is **not** a claim that the commands ran.

## Additional checks

- TypeScript/TSX syntax parse: **60 files PASS**
- JSON parse: **PASS**
- YAML parse: **PASS**
- OpenAPI path inventory: **PASS**
- `git diff --check`: **PASS**
- Git working tree after commit: **CLEAN**

## Not available here

- pnpm dependency installation
- Jest suite
- Next.js build
- full ESLint/typecheck
- Docker build/compose
- runtime L3 conformance against Core Hub

## Push

Remote configured:

`https://github.com/CSMJU2030/csmju-team-up.git`

Push attempt failed before authentication because DNS/network access to `github.com` is unavailable in the current execution environment.
