# Deployment — ขึ้นระบบย่อยบน server

**เวอร์ชัน 1.4** (standards 1.8.4 · แก้เพิ่ม 7 ต.ค. 2569 — ข้อ 2 · 5 · 7.2) · ตัวตรวจ `DEP-01..04` · image สร้างด้วย `subsystem-images.yml`

ทุกระบบย่อยจะขึ้น server กลางของรายวิชา (เครื่องเดียวกับ Core Hub `https://csmju2030.jowave.com`)
เอกสารนี้บอกว่า**ทีมต้องเตรียมอะไรใน repo** (ข้อ 3–4, 6) และ**DevOps ทำอะไรบน server** (ข้อ 5, 7)

> **สถานะ (6 ต.ค. 2569):** อาจารย์อนุมัติชื่อเว็บ (ข้อ 2) และขยายเครื่องแล้ว — ขึ้นระบบทีละระบบที่ผ่าน `DEP-01..04`
> และซ้อมบน server แล้ว (ข้อ 7) · ตัวอย่างที่ผ่านครบ: `demo-student-subsystem`

---

## 1. ภาพรวม

```text
ผู้ใช้ ─https─► Cloudflare ─► Apache (server :443) ─► <ระบบ>-web  Next.js :3000 ─► <ระบบ>-api  NestJS :4000 ─► PostgreSQL กลาง
                  (proxy)     อ่านชื่อ → พอร์ต 50xx       (127.0.0.1:50xx)             (ไม่เปิดออกนอก)              (ฐานของระบบเอง)
```

แต่ละระบบ = **2 image** ที่ GitHub Actions build จาก repo ของทีมแล้วเก็บไว้ที่ GitHub Container Registry (ghcr.io)
server แค่ดึง image ไปรัน — **ไม่ build บน server** (การ build Next.js ใช้ RAM ราว 1.2 GB ต่อครั้ง)
ฐานข้อมูลไม่ใช่ image ของทีม: DevOps สร้างฐานให้ใน PostgreSQL ตัวกลาง (ข้อ 4)

| ใคร | ทำอะไร |
|---|---|
| ทีม (AIE · PL) | `frontend/Dockerfile` · `backend/Dockerfile` · `.dockerignore` · Next.js standalone · จำกัด connection · ทดสอบด้วย `docker compose` ในเครื่อง (ข้อ 3, 4, 6) |
| DevOps | วาง `images.yml` ในทุก repo · สร้างฐาน + role · compose และ Apache บน server · token สำหรับดึง image (ข้อ 5, 7) |
| PL | ส่งคำขอขึ้น server เมื่อพัฒนาและทดสอบในเครื่องเสร็จแล้ว (ข้อ 7.2) · หลังขึ้นแล้ว merge เข้า `main` = อัปเดตระบบบน server |

---

## 2. ชื่อเว็บของแต่ละระบบ (อาจารย์อนุมัติ 6 ต.ค. 2569)

- **`https://<ชื่อในทะเบียน>.jowave.com`** เช่น `https://csmju-quiz.jowave.com` — อาจารย์จด subdomain ให้จากรายชื่อในไฟล์ map ของ Apache (ข้อ 7.1) · เป็นชื่อชั้นเดียว
  เพราะใบรับรอง https ของ Cloudflare ครอบแค่ `*.jowave.com` (ชื่อสองชั้นอย่าง `quiz.csmju2030.jowave.com` เบราว์เซอร์จะเตือนว่าไม่ปลอดภัย)
- **ห้ามแยกระบบด้วย path** เช่น `csmju2030.jowave.com/quiz` — `/auth/login` `/auth/callback` `/auth/logout`
  ต้องอยู่ที่รากของ origin ([auth-contract](auth-contract.md) ข้อ 5) และเบราว์เซอร์กั้นความปลอดภัยตาม origin ไม่ใช่ตาม path:
  ระบบที่อยู่ origin เดียวกันอ่านหน้าและเรียก API ของกันได้ และได้คุกกี้ของ Core Hub ไปด้วย
- ชื่อในทะเบียน (`name` · [subsystem-registry](subsystem-registry.md) ข้อ 2) จะกลายเป็น subdomain — ต้องขึ้นต้นด้วย `csmju-` และยาวไม่เกิน **63 ตัวอักษร**
- **ขึ้น server แล้ว login จาก localhost ไม่ได้อีก** (PM ตัดสิน 7 ต.ค. 2569) — ทะเบียนหนึ่งระบบมี callback ได้ค่าเดียว
  พอระบบขึ้น server แล้ว admin เปลี่ยน callback เป็น `https://<ชื่อ>.jowave.com/auth/callback` ทันที ·
  จากนั้น `http://localhost:32xx` ของทีมนั้น login ผ่าน Core Hub ไม่ได้ ต้องทดสอบบน server (merge เข้า `main` แล้วรอ ~10 นาที) —
  **ขอขึ้น server เมื่อพัฒนาและทดสอบในเครื่องเสร็จแล้วเท่านั้น** ([subsystem-registry](subsystem-registry.md) ข้อ 4)
- **ตอนเปิดใช้จริง** server ปิดโหมดก่อนเปิดใช้ ทะเบียนที่ยังเป็น `http://localhost` ใช้ไม่ได้ทันที — ระบบที่ยังไม่ขึ้น server จะเปิดใช้ไม่ได้

---

## 3. image ของระบบ (`DEP-01..04`)

### 3.1 สองตัวต่อระบบ

| | web | api |
|---|---|---|
| Dockerfile | `frontend/Dockerfile` — copy จาก [`templates/csmju-subsystem-web/`](../templates/csmju-subsystem-web/) | `backend/Dockerfile` + `backend/docker/entrypoint.sh` — copy จาก `demo-student-subsystem` |
| build context | **รากของ repo** (`docker build -f frontend/Dockerfile .`) | **รากของ repo** (`docker build -f backend/Dockerfile .`) |
| ชื่อ service ใน compose | **`web`** | **`api`** |
| พอร์ตใน container | `3000` | `4000` (env `PORT`) |
| ผู้ใช้ | `node` | `node` |
| ตอนสตาร์ต | `node frontend/server.js` | `prisma migrate deploy` แล้ว `node dist/src/main.js` |
| health | รับการเชื่อมต่อที่ `3000` | `GET /api/health` ตอบ 200 (`API-05`) |
| ออกสู่ภายนอก | ผ่าน Apache เท่านั้น | ไม่เปิด — web ส่ง `/api/*` และ `/auth/*` มาให้ |

พอร์ต `32xx` / `42xx` ของทีมใช้ตอน dev บนเครื่องเดียวเท่านั้น ใน container ทุกระบบใช้ `3000` / `4000` เหมือนกัน
เพราะแต่ละระบบอยู่ใน network ของตัวเอง

build context เป็นรากของ repo เพราะ pnpm เก็บ `pnpm-lock.yaml` ไว้ที่ราก — Dockerfile ทั้งสองตัว copy lockfile
แล้วติดตั้งเฉพาะ package ของตัวเอง (`--filter frontend...` / `--filter backend...`)

### 3.2 `BACKEND_URL` ถูกฝังตอน build

`rewrites()` ใน `next.config.ts` ถูกคำนวณตอน `next build` แล้วฝังลงไฟล์ build —
**ตั้ง `BACKEND_URL` ตอนรัน container แล้วไม่มีผล** (ทดสอบแล้ว: image ยังส่งไปที่ค่าตอน build)

Dockerfile ของ template จึง build ด้วย `BACKEND_URL=http://api:4000` ซึ่งคือ service `api` ใน compose ของระบบเดียวกัน
**ห้ามเปลี่ยนชื่อ service `api` หรือพอร์ต `4000`** · ตอน dev ค่ายังมาจาก `.env.local` (`http://127.0.0.1:42xx`) เหมือนเดิม

หน้าที่ prerender ตอน build (หน้าที่ไม่อ่านคุกกี้) ก็ใช้ `CORE_HUB_WEB_URL` ตอน build เหมือนกัน —
Dockerfile ใส่ค่า server จริงไว้ให้แล้ว (ปุ่ม "กลับ CSMJU Portal")

### 3.3 กฎที่ CI ตรวจ

| รหัส | กฎ | ทำไม |
|---|---|---|
| `DEP-01` | มี `backend/Dockerfile` · และ `frontend/Dockerfile` เมื่อมี `frontend/package.json` | GitHub Actions build image จากไฟล์นี้ (ข้อ 5) |
| `DEP-02` | **stage สุดท้าย**ของ Dockerfile ตั้ง `USER` ที่ไม่ใช่ `root` / `0` | ถ้าโค้ดมีช่องโหว่ ผู้บุกรุกไม่ได้สิทธิ์ root ใน container · `USER` ใน stage ก่อนหน้า**ไม่ตามมา** |
| `DEP-03` | `.dockerignore` ที่รากกัน `**/.env*` (หรือ `**/.env` + `**/.env.*`) และ `**/node_modules` | `.env` มี secret — ติดใน image เท่ากับทุกคนที่ดึง image อ่านได้ · `node_modules` ของ macOS/Windows ใช้บน Linux ไม่ได้ · ต้องมี `**/` เพราะ `.env` เฉย ๆ กันแค่ที่ราก ไม่กัน `backend/.env` |
| `DEP-04` | `frontend/next.config.*` ตั้ง `output: "standalone"` | image มีแค่ server ที่ trace แล้ว (~290 MB) และ Dockerfile copy `.next/standalone` |

ข้ามทั้งหมดเมื่อ repo เพิ่ง scaffold (ยังไม่มี `package.json` ทั้งสองฝั่ง) · ระบบที่ไม่มี UI ต้องมีแค่ `backend/Dockerfile`

### 3.4 ต้องทำตามแม้ไม่มีตัวตรวจ

- **ไม่มี secret ใน Dockerfile** (`ARG` / `ENV`) — ค่าทุกอย่างมาจาก env ตอนรัน (ข้อ 4.2)
- **ระบบไฟล์ของ container อ่านอย่างเดียว** — เขียนได้แค่ `/tmp` (ข้อมูลหายเมื่อ container เริ่มใหม่) · ทดสอบด้วย compose ของ demo ซึ่งล็อกแบบเดียวกับ server ·
  ไฟล์ที่ผู้ใช้อัปโหลดเก็บได้ 2 ที่ตามชนิด:
  - **รูปที่ใครเห็นก็ได้** (ข่าว · ภาพประกอบ) → Core Hub `POST /images` ([reference-data](reference-data.md) ข้อ 6) — เปิดได้โดยไม่ login และถูกแปลงเป็น WebP
  - **เอกสารที่ต้องตรวจสิทธิ์หรือเก็บต้นฉบับ** (บิล · สลิป · PDF · ไฟล์ที่มีข้อมูลส่วนบุคคล) → ฐานข้อมูลของระบบเอง (ข้อ 4.3)
- **log ออก stdout เท่านั้น** ([logging](logging.md)) — ห้ามเขียนไฟล์ log
- **ห้าม `chown -R` ทั้งโฟลเดอร์แอป** — Docker เก็บไฟล์ทุกไฟล์ซ้ำอีกชั้น image โตเท่าตัว (user `node` อ่านไฟล์ของ root ได้อยู่แล้ว)
- **ลบ store และ cache ของ pnpm ใน `RUN` เดียวกับ `pnpm install`** — ไม่งั้นติดไปใน image อีกหลายร้อย MB (ดู `backend/Dockerfile` ของ demo)
- **อย่าใส่ `--ignore-scripts` ตอนติดตั้งของ runtime** — `@prisma/engines` ต้องดาวน์โหลด engine ที่ `prisma migrate deploy` ใช้ตอนนั้น
  ถ้าข้าม container จะพยายามดาวน์โหลดตอนสตาร์ตแล้วพัง
- **ตอนสตาร์ตห้าม** `prisma migrate dev` · `prisma db push` · seed ข้อมูลตัวอย่าง — ใช้ `prisma migrate deploy` เท่านั้น
- งานตั้งเวลาต้องระบุ `timeZone: 'Asia/Bangkok'` ([tech-stack](tech-stack.md) ข้อ 1.4.1)
- **ห้ามสร้าง URL เต็มจาก request** (`new URL(path, request.url)` · `request.headers.host` · `req.protocol`) — ในเครื่องได้
  `http://localhost:32xx` แต่บน server request ผ่าน Cloudflare และ Apache มา จะได้ host หรือ `http` ผิด · redirect ภายในระบบใช้ path
  (`/bookings`) · ลิงก์ไป Core Hub ใช้ `CORE_HUB_WEB_URL` · ห้ามฝัง `localhost` ในโค้ด
- **ไม่รันโค้ดที่ผู้ใช้ส่งมา** ใน api — ถ้าระบบต้องทำ (ตัวตรวจโค้ด) ทำตามข้อ 8 เท่านั้น

---

## 4. ฐานข้อมูลและ env ตอนรัน

### 4.1 ฐานข้อมูล

- **PostgreSQL 16 ตัวกลาง** บน server (แยกจากฐานของ Core Hub) — DevOps สร้าง **database + role ระบบละ 1 ชุด**
  role เป็นเจ้าของ database ของตัวเองและเข้าฐานอื่นไม่ได้ จึงยังเป็น "1 ระบบ = 1 ฐานข้อมูล" ตามเดิม
- migration รันเองตอน api สตาร์ต (`prisma migrate deploy` ใน `entrypoint.sh`) · migration ที่ขึ้น server แล้วห้ามแก้หรือลบ
- **role ของระบบไม่ใช่ superuser** — migration ที่มี `CREATE EXTENSION` (เช่น `uuid-ossp` · `pg_trgm` · `citext`) ผ่านในเครื่อง
  (user `postgres`) แต่**ตกบน server** · ใช้ของที่มีในตัว PostgreSQL 16 แทน (`gen_random_uuid()` ไม่ต้องใช้ extension ·
  `@default(uuid())` ของ Prisma สร้างค่าฝั่งแอป) · ถ้าจำเป็นจริงให้ขอ DevOps ติดตั้งให้ก่อน แล้วเขียน `CREATE EXTENSION IF NOT EXISTS`
- **จำกัด connection ต่อระบบ** ด้วย env `DATABASE_POOL_MAX` (ค่าเริ่มต้น `5`) — `pg` เปิดได้ 10 เส้นต่อระบบโดยค่าเริ่มต้น
  37 ระบบจะต้องใช้ 370 เส้น ซึ่งเกินที่ PostgreSQL รับได้ · ทำแบบ demo (`backend/src/prisma/prisma.service.ts`):

```ts
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DATABASE_POOL_MAX) || 5,
});
```

### 4.2 env ที่ server ส่งให้

**api**

| env | ค่าบน server | หมายเหตุ |
|---|---|---|
| `NODE_ENV` | `production` | คุกกี้เป็น `Secure` · backend ตรวจ env เข้มขึ้น |
| `PORT` | `4000` | |
| `DATABASE_URL` | DevOps กำหนด | ฐานของระบบเองเท่านั้น |
| `DATABASE_POOL_MAX` | `5` | ข้อ 4.1 |
| `CORE_HUB_URL` · `CORE_HUB_JWKS_URL` · `CORE_HUB_WEB_URL` | `https://csmju2030.jowave.com` (JWKS: `…/api/v1/.well-known/jwks.json`) | [connect-core-hub](connect-core-hub.md) ข้อ 4 |
| `CORE_HUB_ISSUER` · `CORE_HUB_AUDIENCE` | `core-hub` · `csmju2030` | ค่าตายตัวของสัญญา |
| `SUBSYSTEM_ID` | ชื่อในทะเบียน | |
| `TZ` | `Asia/Bangkok` | |
| ค่าของทีมเอง | ตามที่ทีมแจ้ง | ต้องมีใน `backend/.env.example` · ค่าลับส่งให้ DevOps ทางข้อความส่วนตัว ห้าม commit |

**web** — `CORE_HUB_WEB_URL` · `SUBSYSTEM_ID` · `TZ` (`BACKEND_URL` ฝังใน image แล้ว ข้อ 3.2)

DevOps ใช้ `backend/.env.example` เป็นรายการ env ของระบบ — env ที่ไม่อยู่ในไฟล์นั้นจะไม่ถูกตั้งบน server

### 4.3 เอกสารที่ผู้ใช้อัปโหลด (บิล · สลิป · PDF)

เอกสารที่ต้องตรวจสิทธิ์ก่อนเปิด หรือต้องเก็บไฟล์ต้นฉบับไว้เป็นหลักฐาน เก็บในฐานข้อมูลของระบบเอง —
ห้ามใช้บริการรูปของ Core Hub (เปิดสาธารณะ · cache 1 วัน · แปลงไฟล์) และห้ามเขียนลงดิสก์ของ container (อ่านอย่างเดียว · หายเมื่อเริ่มใหม่)

| เรื่อง | กติกา |
|---|---|
| ชนิดไฟล์ | กำหนดรายการที่รับ (เช่น PDF · JPEG · PNG · WebP) และ**ตรวจจาก byte ต้นไฟล์** (`%PDF-` · `FF D8 FF` · `89 50 4E 47` · `RIFF…WEBP`) — ห้ามเชื่อชื่อไฟล์หรือ `Content-Type` ที่ส่งมา · ไม่รับ SVG · HTML |
| ขนาด | ไม่เกิน **10 MB** ต่อไฟล์ — ตั้ง `limits.fileSize` ที่ตัวรับ multipart ให้ตัดตั้งแต่ตอนรับ ไม่ใช่ตรวจหลังรับครบ · ไฟล์เกินหรือชนิดไม่ตรงตอบ `400 VALIDATION_ERROR` (enum ปิดใน `contracts/error-codes.json` ไม่มี 413) · ทดสอบไฟล์ขนาดใกล้เพดานผ่านหน้าเว็บด้วย `docker compose` เพราะคำขอวิ่งผ่าน rewrites ของ Next.js ก่อนถึง api |
| ต้นฉบับ | เก็บ bytes ตามที่อัปโหลด ไม่ย่อ ไม่แปลง · เก็บ `sha256` ไว้พิสูจน์ว่าไม่ถูกแก้ |
| ตาราง | แยกตารางไฟล์ออกจากตารางธุรกิจ (คอลัมน์ `Bytes` ของ Prisma) — query รายการทั่วไปต้องไม่ดึงคอลัมน์ไฟล์มาด้วย |
| เปิดดู | ส่งผ่าน api ที่**ตรวจสิทธิ์ทุกครั้ง** · `Content-Type` จากชนิดที่ตรวจได้ตอนรับ · `Content-Disposition: attachment` · `X-Content-Type-Options: nosniff` · `Cache-Control: private, no-store` |
| ลบ | ตามกติกาธุรกิจของระบบ — เอกสารการเงินควร soft delete หรือห้ามลบหลังอนุมัติ · บันทึกว่าใครลบ |
| ปริมาณ | ประเมินขนาดรวมต่อปีแจ้ง DevOps · เกิน **1 GB** ต้องตกลงกับ DevOps ก่อน (ฐานข้อมูลใช้ร่วมกันและ backup ทั้งก้อน) |

```prisma
model Attachment {
  id                   String   @id @default(uuid())
  mimeType             String   @map("mime_type")          // จากการตรวจ byte ต้นไฟล์
  sizeBytes            Int      @map("size_bytes")
  sha256               String   @map("sha256") @db.Char(64)
  content              Bytes    @map("content")            // ไฟล์ต้นฉบับ
  uploadedByCoreUserId String   @map("uploaded_by_core_user_id") @db.VarChar(64)
  createdAt            DateTime @default(now()) @map("created_at")

  @@map("attachments")
}
```

---

## 5. image บน GitHub Container Registry

ทุกครั้งที่ push เข้า `main` workflow `.github/workflows/images.yml` ของ repo
(DevOps วางให้ ทีมแก้ไม่ได้ — `GH-03`) เรียก `subsystem-images.yml` ของ standards ซึ่ง build แล้ว push:

| image | จาก | tag |
|---|---|---|
| `ghcr.io/csmju2030/<repo>-api` | `backend/Dockerfile` | `main` · `sha-<commit 7 ตัว>` |
| `ghcr.io/csmju2030/<repo>-web` | `frontend/Dockerfile` | เหมือนกัน |

- **build เมื่อ `.standards-version` เป็น 1.8.0 ขึ้นไปเท่านั้น** — แปลว่า Dockerfile ผ่าน `DEP-01..04` แล้ว ·
  ก่อนหน้านั้น workflow แค่ตรวจเวอร์ชัน (job **Plan**) แล้วข้ามพร้อมแจ้งเตือน ไม่ตก · Dockerfile ที่เขียนก่อนมีข้อกำหนดนี้
  (พอร์ตอื่น · รันเป็น root · ไม่ใช่ standalone) จึงไม่ถูก build ไปจนกว่าทีมจะแก้แล้วเลื่อนเวอร์ชัน
- ยังไม่มี Dockerfile → ข้าม image นั้นพร้อมแจ้งเตือน ไม่ตก
- build เฉพาะ `main` (server ดึง `:main`) · branch อื่นสั่งเองได้ที่ **Actions → Images → Run workflow** ได้ tag ตามชื่อ branch
- image เป็น **private** ตาม repo · server ดึงด้วย token อ่านอย่างเดียว (ข้อ 7)
- ดูผลที่แท็บ **Actions → Images** ของ repo · build ตกให้แก้ใน repo แล้ว merge ใหม่
- **ขึ้น server:** server ดึง `:main` ใหม่เองทุก ~10 นาทีหลังขึ้นระบบครั้งแรกแล้ว (ข้อ 7.2) · **ย้อนเวอร์ชัน:** DevOps ปักหมุด tag `sha-…` ของ commit ก่อนหน้า

---

## 6. ทดสอบในเครื่องก่อนเปิด PR

ใช้ `docker-compose.yml` แบบของ demo: service `db` · `api` · `web` (ชื่อต้องตรง ข้อ 3.1) ·
web เปิดที่ `127.0.0.1:<พอร์ต frontend ของทีม>:3000` เพื่อให้ callback `http://localhost:32xx/auth/callback` ที่ลงทะเบียนไว้ยังใช้ได้ ·
api และ web ล็อกแบบเดียวกับ server (`read_only` · `cap_drop: [ALL]` · `no-new-privileges`) ·
จำกัด RAM เท่ากับ server (`mem_limit` api `512m` · web `384m`) และหมุน log (`max-size: 10m` · `max-file: 3`)

```bash
docker compose up -d --build        # build ทั้งสอง image แล้วรัน db + api + web
docker compose ps                   # ทั้งสามต้อง healthy
docker compose logs api             # ต้องเห็น migration ผ่าน และ subsystem.started
docker stats --no-stream            # ดู RAM
docker compose down                 # หยุด (ข้อมูลยังอยู่ใน volume)
```

- [ ] `./standards/scripts/run-all-checks.sh .` ผ่าน รวม `DEP`
- [ ] `docker compose ps` — `db` `api` `web` เป็น `healthy` ทั้งหมด
- [ ] เปิด `http://localhost:32xx` แล้ว login ผ่าน Core Hub กลับมาได้ (ใช้ Chrome — รับคุกกี้ `Secure` บน `localhost`)
- [ ] `/api/*` ผ่าน web ไปถึง api (`curl http://localhost:32xx/api/health` ตอบ 200)
- [ ] RAM ตอนใช้งานปกติ web + api รวมไม่เกิน **~400 MB** (demo: web ~40 MB · api ~85 MB)

### 6.1 ในเครื่องต่างจาก server ตรงไหน

image ตัวเดียวกัน แต่สิ่งรอบ ๆ ไม่เหมือนกัน — รันในเครื่องได้คือด่านแรก ก่อนเปิดใช้ DevOps จะซ้อมรัน image จาก ghcr.io บน server จริงกับทีมอีกครั้ง

| เรื่อง | ในเครื่อง | บน server | ทีมต้องทำ |
|---|---|---|---|
| CPU | Mac รุ่น M = arm64 · Windows/Intel = amd64 | amd64 (GitHub build ให้) | ไม่ใช้ package ที่มีแต่ binary ของเครื่องตัวเอง · ดูผล Actions → Images ทุกครั้ง |
| ฐานข้อมูล | user `postgres` (superuser) ใน container ของทีม | role ของระบบใน PostgreSQL ตัวกลาง | ห้าม `CREATE EXTENSION` เอง (ข้อ 4.1) · ห้ามพึ่งข้อมูลจาก seed |
| env | เขียนใน `docker-compose.yml` | DevOps ตั้งตาม `backend/.env.example` | ประกาศ env ทุกตัวใน `.env.example` (ข้อ 4.2) — ตัวที่ไม่มีจะไม่ถูกตั้ง และ api สตาร์ตไม่ขึ้น |
| URL | `http://localhost:32xx` | `https://<ชื่อ>.jowave.com` ผ่าน Cloudflare + Apache | ห้ามสร้าง URL เต็มจาก request และห้ามฝัง `localhost` (ข้อ 3.4) |
| RAM | compose ของ demo จำกัดเท่า server | api `512m` · web `384m` | เกินแล้วถูก kill — ดู `docker stats` ตอนทดสอบ |
| เน็ตขาออก | ออกได้ทุกที่ | ออกได้ แต่ IP ของ server ทั้งเครื่องใช้เพดานเรียก Core Hub ร่วมกัน | cache ข้อมูลอ้างอิงตาม [reference-data](reference-data.md) · ไม่เรียก Core Hub ทีละแถว |
| callback | `http://localhost:32xx/auth/callback` (โหมดก่อนเปิดใช้) | `https://<ชื่อ>.jowave.com/auth/callback` | ทะเบียนมีได้ค่าเดียว — เปลี่ยนทันทีที่ขึ้น server แล้ว localhost login ไม่ได้อีก (ข้อ 2) |

---

## 7. งานของ DevOps

**ครั้งเดียว**

1. ตั้งค่า org: **Settings → Packages → Package creation** ให้สร้าง package แบบ private ได้ ·
   ไม่ต้องเพิ่ม action ใน allow-list — `subsystem-images.yml` ใช้แค่ `actions/checkout` กับคำสั่ง `docker` บน runner
2. รัน `org-settings/add-image-workflow.sh v1.8.1` (dry run) → `--apply --merge`
   — วาง `images.yml` ทุก repo · repo ที่ยังไม่ถึง 1.8.0 จะไม่ build จนกว่าทีมจะเลื่อนเอง (ทำแล้ว 6 ต.ค. 2569 ครบ 38 repo)
3. บน server: token อ่าน package (classic PAT สิทธิ์ `read:packages` เท่านั้น ของบัญชีที่อ่าน repo ได้) →
   `docker login ghcr.io` · ห้ามเก็บ token ใน repo หรือ log
4. PostgreSQL ตัวกลาง: `max_connections` ไม่น้อยกว่า `จำนวนระบบ × 6 + 20` · network ภายในที่ api ทุกตัวเข้าถึงได้ · backup ด้วย `pg_dump` ทุกฐาน
5. Apache อ่านชื่อ → พอร์ตจากไฟล์ map (ข้อ 7.1) · ชื่อที่ไม่อยู่ใน map ตอบ 404 · ใบรับรองบนเครื่องต้องครอบ `*.jowave.com`
   (เช่น Cloudflare Origin Certificate) และ Cloudflare ตั้ง SSL เป็น Full (strict)
6. เครื่องที่อยู่หลัง Cloudflare ต้อง:
   - รับพอร์ต 80/443 เฉพาะจาก[ช่วง IP ของ Cloudflare](https://www.cloudflare.com/ips/) (AWS Security Group) — ทุกคำขอต้องผ่าน Cloudflare
   - ส่ง IP จริงของผู้ใช้ต่อให้ทุกระบบ: `mod_remoteip` ของ Apache (`RemoteIPHeader CF-Connecting-IP` + `RemoteIPTrustedProxy` เป็นช่วง IP ของ Cloudflare) —
     rate limit ต่อ IP ของ Core Hub ต้องเห็นผู้ใช้แต่ละคน ไม่ใช่ Cloudflare
7. เปิด swap ให้เครื่อง (ข้อ 7.3) — ระบบที่ไม่มีคนใช้จะย้ายไปพักใน swap และคืน RAM ให้ระบบที่มีคนใช้

### 7.1 ชื่อเว็บ → พอร์ต (`/etc/apache2/csmju-map.txt`)

Apache ใช้ไฟล์เดียวจับคู่ชื่อเว็บกับพอร์ตบนเครื่อง — หนึ่งบรรทัดต่อระบบ `<ชื่อในทะเบียน> <พอร์ต>` (ตัวอย่าง):

```text
csmju-quiz 5001
csmju-lab-booking 5002
```

- พอร์ตเรียงต่อจากเลขสุดท้ายในไฟล์ เริ่มที่ `5001` · **ห้ามใช้ซ้ำ และห้ามเปลี่ยนเลขของระบบที่ขึ้นแล้ว**
- หน้าเว็บของระบบนั้นเปิดที่ `127.0.0.1:<พอร์ต>` บนเครื่องเท่านั้น (compose ด้านล่าง) — api ไม่มีพอร์ตบนเครื่อง
- อาจารย์ดึงชื่อจากไฟล์นี้ไปจด subdomain ให้ · แก้ไฟล์ต้องใช้ `sudo` · Apache อ่านไฟล์ใหม่เองเมื่อไฟล์เปลี่ยน
  (ถ้าชื่อใหม่ยังไม่ขึ้น: `sudo apachectl configtest && sudo systemctl reload apache2`)

### 7.2 ต่อระบบ

**PL ส่งคำขอขึ้น server** (ถึง PM) เมื่อครบทุกข้อ — ไม่ครบยังไม่ขึ้น:

- [ ] ทะเบียนใน Core Hub อนุมัติและเปิดใช้งานแล้ว · `.standards-version` ≥ 1.8.0 · CI ล่าสุดของ `main` ผ่านครบรวม `DEP`
- [ ] Actions → **Images** ล่าสุดของ `main` ผ่าน (Plan · Image (api) · Image (web))
- [ ] ทดสอบ `docker compose up -d --build` ในเครื่องผ่านตามข้อ 6 และ login ผ่าน `http://localhost:32xx` ได้
- [ ] รายการ env ครบใน `backend/.env.example` · ค่าลับส่งให้ PM ทางข้อความส่วนตัว
- [ ] สิ่งพิเศษ (ถ้ามี): WebSocket · รันโค้ดของผู้ใช้ (ข้อ 8) · เก็บเอกสารในฐาน (ขนาดต่อปี — ข้อ 4.3)
- [ ] ทีมรับทราบว่าหลังขึ้น server จะ login จาก localhost ไม่ได้อีก (ข้อ 2)

**DevOps ทำ:**

1. เพิ่มบรรทัดใน `csmju-map.txt` (ข้อ 7.1) แล้วแจ้งอาจารย์ว่ามีชื่อใหม่
2. สร้างฐานข้อมูลและ role:

```sql
-- ชื่อ role/ฐาน = ชื่อในทะเบียน เปลี่ยน - เป็น _
CREATE ROLE csmju_quiz LOGIN PASSWORD '<สุ่มใหม่ ห้ามใช้ซ้ำ>' CONNECTION LIMIT 6;
CREATE DATABASE csmju_quiz OWNER csmju_quiz;
REVOKE ALL ON DATABASE csmju_quiz FROM PUBLIC;
```

3. compose ของระบบ (ตัวอย่าง `csmju-quiz` ที่ได้พอร์ต `5001`):

```yaml
# /srv/subsystems/csmju-quiz/compose.yml — ตัวอย่าง (ค่าจริงอยู่ใน api.env บน server เท่านั้น)
name: csmju-quiz
x-hardening: &hardening
  read_only: true
  cap_drop: [ALL]
  security_opt: ['no-new-privileges:true']
  restart: unless-stopped
  logging: { driver: json-file, options: { max-size: '10m', max-file: '3' } }   # 37 ระบบ — ไม่หมุน log ดิสก์เต็ม
services:
  api:
    <<: *hardening
    image: ghcr.io/csmju2030/csmju-quiz-api:main
    env_file: ./api.env              # DATABASE_URL · CORE_HUB_* · SUBSYSTEM_ID · ค่าของทีม
    environment: { NODE_ENV: production, PORT: 4000, DATABASE_POOL_MAX: 5, TZ: Asia/Bangkok }
    tmpfs: ['/tmp:size=32m']
    mem_limit: 512m
    networks: [default, subsystems-db]
  web:
    <<: *hardening
    image: ghcr.io/csmju2030/csmju-quiz-web:main
    environment: { CORE_HUB_WEB_URL: 'https://csmju2030.jowave.com', SUBSYSTEM_ID: csmju-quiz, TZ: Asia/Bangkok }
    tmpfs: ['/tmp:size=32m', '/app/frontend/.next/cache:size=64m']
    depends_on: { api: { condition: service_healthy } }
    ports: ['127.0.0.1:5001:3000']   # พอร์ตของระบบใน csmju-map.txt — Apache ส่ง csmju-quiz.jowave.com มาที่นี่
    mem_limit: 384m
networks:
  subsystems-db: { external: true }
```

4. `docker compose up -d` แล้วเปิด `https://<ชื่อ>.jowave.com` ว่าหน้าเว็บขึ้น
5. admin เปลี่ยน callback ในทะเบียนเป็น `https://<ชื่อ>.jowave.com/auth/callback` ทันที แล้วทดสอบ login กับทีม (ข้อ 2)

- **อัปเดตอัตโนมัติ:** server ดึง image `:main` ใหม่ของทุกระบบทุก ~10 นาที และรีสตาร์ตเฉพาะระบบที่ image เปลี่ยน —
  PL merge เข้า `main` คือการ deploy ไม่ต้องขอ DevOps · ลบ image เก่าทุกวัน (`docker image prune`)
- **ย้อนเวอร์ชัน:** PL แจ้ง DevOps → ปักหมุดระบบนั้นที่ tag `sha-…` ก่อนหน้าและหยุดอัปเดตอัตโนมัติเฉพาะระบบนั้น ·
  migration ย้อนไม่ได้ ถ้าพังเพราะ migration ต้องกู้ฐานจาก backup ของคืนก่อน
- ขนาดโดยประมาณต่อระบบ: web ~290 MB · api ~800 MB (ส่วนใหญ่คือ Prisma CLI ที่ใช้รัน migration)

### 7.3 ความจุและ swap

ระบบย่อยหนึ่งระบบใช้ RAM ราว **125 MB ตลอดเวลาแม้ไม่มีคนใช้** (api ~90 MB · web ~35 MB) เพราะ Node.js ต้องรันค้างรอรับคำขอ
แต่หน่วยความจำส่วนใหญ่ของระบบที่ไม่มีคนใช้แค่ถูกจองไว้ — เปิด swap แล้วระบบปฏิบัติการจะย้ายส่วนนั้นไปพักบนดิสก์เอง
ระบบที่มีคนใช้อยู่จึงได้ RAM เต็ม

```bash
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -m
```

ทดลองกับ demo (6 ต.ค. 2569): ระบบที่ถูกย้ายไปพักใน swap เหลือ RAM **35–50 MB** ยัง healthy และไม่ถูก kill ·
ระบบที่หลับอยู่ตอบช้าแค่คำขอแรก ๆ (~0.5–1 วินาที) แล้วกลับมาเร็วตามปกติ

| ส่วน | RAM โดยประมาณ (ต้องวัดจริงบนเครื่อง) |
|---|---|
| ระบบที่มีคนใช้พร้อมกัน 5 × ~200 MB | ~1.0 GB |
| ระบบที่ไม่มีคนใช้ 32 × ~45 MB | ~1.4 GB |
| Core Hub · PostgreSQL ตัวกลาง · Apache | ~1.0 GB |
| รวม — เครื่องใช้ได้ ~3 GB + swap 4 GB | ~3.4 GB |

- **ห้ามบีบ `mem_limit` ต่ำกว่าที่ระบบใช้ตอนทำงาน** — ใช้ค่าตามข้อ 7.2 (api `512m` · web `384m`) แล้วให้ระบบปฏิบัติการเลือกเองว่าอะไรไปพักใน swap ·
  ทดลองบีบเหลือ api `40m` · web `24m` แล้ว ระบบสลับเข้าออก swap ตลอดเวลา ทุกคำขอช้า 0.1–0.9 วินาที
- ไม่ต้องตั้ง `memswap_limit` — Docker ให้แต่ละ container ใช้ swap ได้เท่ากับ `mem_limit` อยู่แล้วเมื่อเครื่องมี swap
- **ดูว่า RAM ไม่พอจริงหรือยัง:** `vmstat 5` — ถ้าคอลัมน์ `si` / `so` (ย้ายเข้า/ออก swap) ไม่เป็น 0 ต่อเนื่องหลายนาที แปลว่าระบบที่มีคนใช้ไม่พอ RAM แล้ว ·
  เก็บตัวเลข `free -m` · `vmstat` · `docker stats` ทุกครั้งที่เพิ่มระบบ แล้วส่งให้อาจารย์เมื่อขอเพิ่ม spec
- **ระบบที่ใช้เป็นช่วง** (เช่นเปิดรับสมัครปีละครั้ง) — `docker compose stop` นอกช่วงที่ใช้ แล้ว `docker compose start` ก่อนเปิด (ข้อมูลในฐานไม่หาย)
- ทางเลือกแทน swap file: zram (swap ที่บีบอัดอยู่ใน RAM · แพ็กเกจ `zram-tools`) เร็วกว่าดิสก์ แต่กิน CPU เพิ่ม — ใช้ swap file ก่อน

---

## 8. ระบบที่ต้องรันโค้ดของผู้ใช้

ระบบที่รับโค้ดจากผู้ใช้มารัน (ตัวตรวจคำตอบ · playground) คือจุดที่ถูกเจาะง่ายที่สุดของทั้ง server — โค้ดนั้นเขียนโดยใครก็ได้
ข้อนี้ใช้กับทุกระบบ (ตอนนี้: `csmju-coding-arena`) · **ต้องให้ PM อนุมัติก่อนเปิดใช้บน server**

### 8.1 ห้าม

| วิธี | ทำไม |
|---|---|
| mount `/var/run/docker.sock` ของ server เข้า container | Docker ตัวหลักรันเป็น root — ใครสั่งได้ก็สร้าง container ที่ mount `/` ของ host ได้ = root ทั้งเครื่อง รวม Core Hub และทุกระบบ |
| docker-socket-proxy | กรองได้แค่ชนิดคำสั่ง ไม่ได้กรอง flag — ยังสั่ง `--privileged` หรือ mount ไฟล์ของ host ได้ |
| Docker-in-Docker เป็น container ที่ 3 | ต้องรันแบบ `--privileged` ซึ่งหลุดออก host ได้ และเพิ่ม container นอก web + api |
| รันโค้ดใน api ตรง ๆ (`child_process` · `eval` · `vm`) | โค้ดผู้ใช้อ่าน env (`DATABASE_URL`) และออกเน็ตได้ · nsjail/bubblewrap ใช้ไม่ได้ใน container ที่ตัด capability |
| บริการตรวจโค้ดภายนอกโดยไม่ได้อนุมัติ | ต้องส่ง test case ที่ซ่อนไว้และโค้ดของผู้ใช้ออกนอก |

### 8.2 ทางที่ใช้

server มี **Docker แบบ rootless ที่แยกไว้รันโค้ดโดยเฉพาะ** (daemon ของ user `judge` ที่ไม่ใช่ root · DevOps ดูแล) —
api ของระบบที่ได้รับอนุมัติสั่ง `docker run` ผ่าน env `DOCKER_HOST` ที่ DevOps ตั้งให้ ระบบยังเป็น web + api เหมือนเดิม

- api ของระบบนั้นบน server รันเป็น uid ของ `judge` และมีแค่ socket ของ daemon นี้ — มองไม่เห็น Docker ตัวหลัก
- user `judge` ไม่มีเน็ตขาออก · image ที่ใช้รันโค้ดดึงไว้ล่วงหน้าโดย DevOps และอ้างด้วย digest
- `backend/Dockerfile` เพิ่มแค่ตัวสั่ง (`RUN apk add --no-cache docker-cli` · `ENV DOCKER_CONFIG=/tmp/.docker`) — ไม่มี daemon ใน image
- `backend/.env.example` ประกาศ `DOCKER_HOST=` (ว่าง = ตอน dev ใช้ Docker ในเครื่อง) และ env ของ image ที่ใช้รันโค้ด
- ถ้าภายหลังได้เครื่องแยกสำหรับรันโค้ด ทีมเปลี่ยนแค่ค่า `DOCKER_HOST`

### 8.3 container ที่รันโค้ดผู้ใช้ — ขั้นต่ำทุกครั้ง

| flag / พฤติกรรม | เพื่อ |
|---|---|
| `--network=none` | ออกเน็ตไม่ได้ |
| `--read-only` + `--tmpfs=/tmp:rw,noexec,nosuid,size=16m` | เขียนได้แค่ `/tmp` และรันไฟล์จากที่นั่นไม่ได้ |
| `--user=65534:65534` · `--cap-drop=ALL` · `--security-opt=no-new-privileges` | ไม่ใช่ root และยกสิทธิ์ไม่ได้ |
| `--memory` = `--memory-swap` · `--cpus` · `--pids-limit` | จำกัด RAM (ไม่ใช้ swap) · CPU · กัน fork bomb |
| `--ulimit nofile=64:64` | จำกัดจำนวนไฟล์ที่เปิดได้ |
| `--rm` + ลบใน `finally` (`docker rm -f <ชื่อ>`) | ไม่มี container ค้างเมื่อ api ล่มกลางงาน |
| `--pull=never` + image อ้างด้วย digest | ใช้ image ที่ DevOps ดึงไว้เท่านั้น ผลตรวจคงที่ |
| จำกัดเวลาและขนาด output ฝั่ง api | โค้ดวนไม่จบหรือพิมพ์ไม่หยุดไม่ทำให้ api ค้าง |
| ตรวจทีละงาน (หรือจำนวนที่ตกลงกับ DevOps) | RAM ของ server ใช้ร่วมกันทุกระบบ |

ตัวอย่างที่ทำครบ: `csmju-coding-arena` `backend/src/evaluation/sandbox-runner.ts` (ขาดแค่ `--ulimit`)

### 8.4 ทดสอบในเครื่อง

`pnpm dev` ใช้ Docker ในเครื่องตามปกติ (ไม่ตั้ง `DOCKER_HOST`) · ถ้าจะทดสอบ api ใน container ให้ mount socket ของ Docker Desktop
ผ่านไฟล์ compose แยกที่ใช้เฉพาะในเครื่อง (`docker-compose.local-judge.yml`) — **ห้ามนำวิธีนี้ไปใช้บน server**
และก่อนเปิดใช้ ซ้อมกับ DevOps บน server ด้วยโค้ดที่พยายามออกเน็ต · เขียนไฟล์ · fork bomb · กิน RAM · วนไม่จบ ทุกข้อต้องถูกหยุด
