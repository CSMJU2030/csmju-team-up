# csmju-team-up

CS TeamUp — Project Collaborator Finder — ระบบย่อยของ CSMJU2030 ที่ merge เข้ากับ repository structure ที่ PM จัดเตรียมไว้ และยกระดับเป็น **CSMJU2030 Standards 1.8.4**

## Stack

- Frontend: Next.js 16.3.6 + React 19.2.8 + Tailwind CSS v4
- Backend: NestJS 11
- Data: Prisma 7.9.1 + PostgreSQL 16
- Auth: Core Hub SSO + JWKS + HttpOnly subsystem cookie
- Contract: OpenAPI ที่ `backend/openapi.json`

## Repository structure

```text
csmju-team-up/
├── .github/                       # PM/DevOps governance files
├── backend/                       # NestJS + Prisma + Core Hub auth
├── frontend/                      # Next.js App Router
├── standards/                     # git submodule → csmju2030-standards
├── subsystem.yaml                 # manifest สำหรับ CI/conformance
├── .standards-version             # 1.8.4
├── pnpm-workspace.yaml
├── docker-compose.yml
├── .dockerignore
├── REPORT.md
└── docs/
    ├── ui-preview.html
    ├── ui-preview.png
    └── ui-preview-mobile.png
```

## เริ่มใน VS Code

ต้องมี Node.js 22.x, Corepack และ pnpm 12.3.4

```bash
git submodule update --init --recursive
corepack enable
corepack prepare pnpm@12.3.4 --activate
pnpm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

Windows CMD:

```bat
git submodule update --init --recursive
corepack enable
corepack prepare pnpm@12.3.4 --activate
pnpm install
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env.local
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

รันแยก terminal:

```bash
pnpm --filter backend start:dev
pnpm --filter frontend dev
```

เปิด `http://localhost:3220`

ดูหน้าตัวอย่าง UI ที่ `http://localhost:3220/preview`

## Docker Compose

```bash
docker compose up -d --build
docker compose ps
```

- web: `127.0.0.1:3220` → container `3000`
- api: `127.0.0.1:4220` → container `4000`
- db: `127.0.0.1:5434` → container `5432`

## Auth

TeamUp ไม่มีหน้า login/password ของตัวเอง เริ่มที่:

`GET /auth/login`

callback:

`http://localhost:3220/auth/callback`

Session ใช้ HttpOnly cookie `<subsystem>_access_token` และตรวจ token ผ่าน Core Hub JWKS; ห้ามเก็บ token ใน `localStorage`

## API

Business API อยู่ใต้ `/api/v1/*`

Health:

`GET /api/health`

OpenAPI source/contract อยู่ที่ `backend/openapi.json`

สร้างใหม่:

```bash
pnpm openapi:generate
pnpm generate:api
```

Frontend ใช้ type ที่ generate จาก OpenAPI ผ่าน `pnpm --filter frontend generate:api`

## Tests / compliance

```bash
pnpm test:syntax
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm standards:check
```

Runtime conformance ต้องมี Core Hub และบัญชีทดสอบนอก repo ตามมาตรฐาน:

```bash
node standards/conformance/run.js
```

ดูผลตรวจรอบนี้ใน `REPORT.md`
