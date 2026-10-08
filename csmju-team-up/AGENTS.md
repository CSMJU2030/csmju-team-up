# CS TeamUp repository notes

- Standards source of truth is `standards/` at tag 1.8.4 and `.standards-version`.
- Keep `.github/workflows/ci.yml` and `images.yml` unchanged; CODEOWNERS assigns them to DevOps.
- Do not create a local login UI or persist access tokens in browser storage.
- Keep Core Hub identity references as `core_user_id` only.
- Frontend is the public entry point; backend owns DB access and authorization.
- Update `backend/openapi.json` whenever an API route changes.
- Follow `REPORT.md` + runtime conformance workflow before release.
