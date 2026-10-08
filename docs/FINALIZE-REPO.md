# Finalize the Git Repository

The ZIP is intentionally self-contained so it can be opened directly in VS Code. The `standards/` directory in this package is a snapshot of Standards 1.8.4 for offline inspection.

Before pushing the real subsystem repository, replace that snapshot with the required Git submodule:

```bash
rm -rf standards
git submodule add -b v1.8.4 https://github.com/CSMJU2030/csmju2030-standards.git standards
git add .gitmodules standards .standards-version
```

Then verify:

```bash
git submodule status
git branch --show-current
./standards/scripts/run-all-checks.sh .
```

Use a branch named `feature/teamup/<topic>` for normal development and create a pull request before merging to `main`.
