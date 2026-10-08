# CS TeamUp — CSMJU2030 Subsystem

ระบบค้นหาโปรเจกต์และเพื่อนร่วมทีมสำหรับนักศึกษา CSMJU โดยยึด CSMJU2030 Standards **1.8.4** เป็น source of truth

Stack: Next.js 16.3.6 + React 19.2.8 + Tailwind CSS v4, NestJS 11, Prisma 7.9.1 + PostgreSQL 16. Frontend เป็น public entry point และ proxy `/api/*` กับ `/auth/*` ไป backend ตาม deployment contract

## โครงสร้าง

```text
csmju-teamup/
├── frontend/                 # Next.js App Router + standard CsmjuAppShell
├── backend/                  # NestJS + Prisma + Core Hub auth
├── standards/                # CSMJU2030 standards 1.8.4
├── .github/workflows/        # CI + DevOps-owned image workflow
├── subsystem.yaml
├── openapi.json
├── REPORT.md
├── docker-compose.yml
└── docs/
    ├── ui-preview.html      # mock หน้าตาแบบไฟล์เดี่ยว
    ├── ui-preview.png       # ภาพตัวอย่าง desktop
    ├── ui-preview-mobile.png # ภาพตัวอย่าง responsive
    └── FINALIZE-REPO.md     # เปลี่ยน standards snapshot เป็น git submodule ก่อน push จริง
```

## รันด้วย VS Code

ต้องใช้ Node.js 22.x และ pnpm 12.3.4

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

บน Windows CMD:

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

แยก terminal:

```bash
pnpm --filter backend start:dev
pnpm --filter frontend dev
```

เปิด `http://localhost:3220`

ดูหน้าตัวอย่างโดยไม่ต้องใช้ API ที่ `http://localhost:3220/preview` หลัง frontend ติดตั้ง dependency แล้ว

หน้า `/preview` ใช้ standard UI components จริงและเป็นข้อมูล mock สำหรับดูหน้าตาเท่านั้น

## Docker Compose

Compose ของทีมใช้ `db`, `api`, `web` เหมือน deployment และ hardening ตาม 1.8.4

```bash
docker compose up -d --build
docker compose ps
docker compose logs api
```

web: `127.0.0.1:3220` → container `3000`  
api: `127.0.0.1:4220` → container `4000`  
db: `127.0.0.1:5434` → container `5432`

## SSO

ระบบไม่มี login/password UI ของตัวเอง เริ่มที่ `/auth/login` และ callback คือ:

`http://localhost:3220/auth/callback`

session เป็น Core Hub access token ใน HttpOnly cookie ของระบบย่อยเท่านั้น ไม่เก็บ token ใน `localStorage` และไม่สร้าง refresh token ใน TeamUp

## API

Business API อยู่ใต้ `/api/v1/*`; health คือ `/api/health`

สร้าง OpenAPI จากโค้ดหลัง dependency ติดตั้งแล้ว:

```bash
pnpm generate:api
```

Frontend ใช้ type ที่ `frontend/src/generated/api.d.ts` และต้องอัปเดต `openapi.json` เมื่อ route เปลี่ยน

## ตรวจมาตรฐาน

```bash
./standards/scripts/run-all-checks.sh .
node standards/conformance/run.js
```

Static checks สามารถรันได้ในเครื่องที่มี standards submodule; runtime conformance ต้องมีระบบที่รันอยู่จริงและบัญชีทดสอบนอก repo ตามเอกสารมาตรฐาน

## สถานะการตรวจใน environment ที่ใช้ทำ ZIP นี้

ผลรัน `standards/scripts/run-all-checks.sh .` ล่าสุด: deterministic checks ผ่านทั้งหมด; `GH-01` ข้ามไม่ได้เพราะ workspace ที่ใช้สร้าง ZIP ไม่ได้อยู่บน Git branch จริง, `API-01` และ `QA-01..04` ถูก skip เพราะ environment นี้ไม่มี pnpm/dependency cache

ก่อนเปิด PR ต้องรัน `pnpm install` ด้วย pnpm 12.3.4 ใน environment ที่เข้าถึง registry ได้ แล้ว commit `pnpm-lock.yaml` ที่ pnpm สร้างให้ตรงกับ package.json

หมายเหตุ: ZIP นี้เก็บ `standards/` เป็น snapshot ของ 1.8.4 เพื่อเปิดใน VS Code ได้ทันที; ก่อน push จริงให้ทำตาม `docs/FINALIZE-REPO.md` เพื่อเปลี่ยนเป็น Git submodule
