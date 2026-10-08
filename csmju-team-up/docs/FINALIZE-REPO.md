# Finalize repository for push

The project is already prepared on:

`feature/csmju-team-up/standard-1-8-4-integration`

and committed as:

`f866a63 feat(csmju-team-up): align web system with PM repository structure`

The PM-provided `.github/` governance files are retained and `.standards-version` is `1.8.4`.

## 1. Initialize the official standards submodule

The ZIP cannot carry a live Git submodule pointer safely, so run this once in the extracted repo:

```bash
rm -rf standards
git submodule add https://github.com/CSMJU2030/csmju2030-standards.git standards
git -C standards checkout v1.8.4
git add standards .gitmodules .standards-version
git commit -m "chore(csmju-team-up): pin standards to v1.8.4"
```

## 2. Install and run the dependency-backed gates

```bash
corepack enable
corepack prepare pnpm@12.3.4 --activate
pnpm install
pnpm generate:api
pnpm test:syntax
pnpm lint
pnpm typecheck
pnpm test
pnpm build
./standards/scripts/run-all-checks.sh .
```

The final static gate must show `0 failed` and no skipped checks where the environment can run the tooling. Runtime release validation must report `✅ CONFORMANT`.

## 3. Push

```bash
git remote -v
git status
git push -u origin feature/csmju-team-up/standard-1-8-4-integration
```

Then open a PR to `main` using the PM-provided template.

Do not commit `.env`, credentials, tokens, `node_modules`, `generated/`, `coverage/`, or package-manager lockfiles other than `pnpm-lock.yaml`.
