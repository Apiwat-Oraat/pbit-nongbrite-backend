# คู่มือติดตั้งและรัน Back-end Project

เอกสารนี้อธิบายวิธีติดตั้งและรัน backend ของโปรเจกต์ `P'Bit Nong'Brite Learning Platform` ทั้งแบบ Docker Compose และแบบ local development

## 1. โครงสร้าง Backend

```text
back-end/
├─ app.js                    # ตั้งค่า Express app, middleware, routes, error handler
├─ server.js                 # โหลด .env และ start server
├─ package.json              # scripts และ dependencies
├─ backend-dockerfile        # Docker image สำหรับ backend
├─ .env                      # environment variables สำหรับ local/Docker
├─ .dockerignore
├─ prisma/
│  ├─ schema.prisma          # Prisma schema
│  ├─ seed.js                # seed data
│  └─ migrations/            # database migrations
└─ src/
   ├─ controllers/
   ├─ services/
   ├─ routers/
   ├─ middlewares/
   ├─ utils/
   └─ lib/
```

API base URL:

```text
http://localhost:8080/api/v1
```

Health check:

```text
http://localhost:8080/api/v1/health
```

## 2. สิ่งที่ต้องติดตั้ง

สำหรับรันด้วย Docker:

- Docker Desktop
- Docker Compose
- Git

สำหรับรันแบบ local:

- Node.js 20 หรือใหม่กว่า
- npm
- PostgreSQL 16 หรือ compatible version
- Git

## 3. Environment Variables

โปรเจกต์ใช้ไฟล์ `back-end/.env` สำหรับ backend runtime

ตัวอย่างค่าที่จำเป็น:

```env
API_PORT=8080

DATABASE_URL=postgresql://postgres:go_database@localhost:5432/TestDB?schema=public

JWT_SECRET=change_this_to_a_long_random_secret
JWT_ACCESS_SECRET=change_this_to_a_long_random_access_secret
JWT_REGISTER_SECRET=change_this_to_a_long_random_register_secret

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
EMAIL_USER=youraccount@gmail.com
EMAIL_PASS=your_app_password

ALLOWED_ORIGINS=http://localhost:3000,https://pbit-nongbrite-project-frontend-2.vercel.app
NODE_ENV=development
```

หมายเหตุ:

- ถ้ารัน backend ใน Docker Compose ค่า `DATABASE_URL` จะถูก override ให้ใช้ host เป็น `db`
- ถ้ารัน backend local ให้ใช้ host เป็น `localhost`
- ห้าม commit ไฟล์ `.env` ที่มี secret จริงขึ้น Git
- ถ้าใช้ Gmail ต้องใช้ App Password ไม่ใช่รหัสผ่านบัญชีหลัก

## 4. วิธีรันด้วย Docker Compose

รันจาก root project:

```bash
docker compose up --build -d
```

ตรวจสอบ container:

```bash
docker compose ps
```

สถานะที่ควรเห็น:

```text
postgres_db       Up ... (healthy)
express_backend   Up ...
```

ดู logs backend:

```bash
docker compose logs -f backend
```

ทดสอบ health check:

```bash
curl http://localhost:8080/api/v1/health
```

ผลลัพธ์ที่คาดหวัง:

```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "..."
}
```

หยุด service:

```bash
docker compose down
```

หยุด service และล้าง database volume:

```bash
docker compose down -v
```

## 5. Flow ของ Docker

`docker-compose.yml` มี service หลัก 2 ตัว:

```text
db       PostgreSQL 16 Alpine
backend  Express + Prisma API
```

ลำดับการทำงาน:

1. Docker Compose สร้าง network และ volume
2. Start `db`
3. รอ `db` healthcheck เป็น `healthy`
4. Start `backend`
5. Backend รัน `npx prisma migrate deploy`
6. Backend รัน `npm start`
7. Express server เปิดที่ port `8080`

คำสั่ง start ใน backend image:

```bash
npx prisma migrate deploy && npm start
```

เหตุผลที่ใช้ `migrate deploy`:

- เหมาะกับการรัน migrations ที่มีอยู่แล้ว
- ไม่สร้าง migration ใหม่ใน container
- ใช้ได้ดีกว่า `migrate dev` สำหรับ Docker/runtime

## 6. วิธีรัน Backend แบบ Local

เข้าโฟลเดอร์ backend:

```bash
cd back-end
```

ติดตั้ง dependencies:

```bash
npm install
```

Generate Prisma client:

```bash
npx prisma generate
```

รัน migrations:

```bash
npx prisma migrate deploy
```

ถ้าต้องการ seed data:

```bash
npx prisma db seed
```

รัน development server:

```bash
npm run dev
```

หรือรันแบบปกติ:

```bash
npm start
```

## 7. Prisma Commands ที่ใช้บ่อย

Generate client:

```bash
npx prisma generate
```

ตรวจสถานะ migration:

```bash
npx prisma migrate status
```

Apply migrations:

```bash
npx prisma migrate deploy
```

สร้าง migration ใหม่หลังแก้ `schema.prisma`:

```bash
npx prisma migrate dev --name <migration-name>
```

เปิด Prisma Studio:

```bash
npx prisma studio
```

Seed database:

```bash
npx prisma db seed
```

## 8. Troubleshooting

### Docker daemon ยังไม่ทำงาน

อาการ:

```text
open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified
```

วิธีแก้:

- เปิด Docker Desktop
- รอจน Docker พร้อม
- ลองรัน `docker info`

### Database ไม่ healthy

ตรวจ logs:

```bash
docker compose logs -f db
```

ตรวจ config:

```bash
docker compose config
```

ค่าที่ควรถูกต้อง:

```text
POSTGRES_USER=postgres
POSTGRES_PASSWORD=go_database
POSTGRES_DB=TestDB
```

### Backend ต่อ database ไม่ได้

ถ้ารันด้วย Docker Compose ต้องใช้ host `db`:

```text
postgresql://postgres:go_database@db:5432/TestDB?schema=public
```

ถ้ารัน local ต้องใช้ host `localhost`:

```text
postgresql://postgres:go_database@localhost:5432/TestDB?schema=public
```

### Port 8080 หรือ 5432 ถูกใช้งาน

ตรวจ process ที่ใช้ port:

```powershell
netstat -ano | findstr :8080
netstat -ano | findstr :5432
```

จากนั้นปิด process เดิม หรือเปลี่ยน port ใน `docker-compose.yml`

### แก้ schema แล้ว backend ไม่ตรง database

สำหรับ local development:

```bash
npx prisma migrate dev --name <migration-name>
npx prisma generate
```

สำหรับ Docker:

```bash
docker compose up --build -d
```

### ต้องการเริ่ม database ใหม่ทั้งหมด

คำสั่งนี้จะล้างข้อมูลใน PostgreSQL volume:

```bash
docker compose down -v
docker compose up --build -d
```

## 9. Checklist หลังติดตั้ง

- `docker compose ps` เห็น `postgres_db` เป็น `healthy`
- `docker compose ps` เห็น `express_backend` เป็น `Up`
- `docker compose logs backend` เห็นข้อความ `Server is running on port 8080`
- เปิด `http://localhost:8080/api/v1/health` แล้วได้ `success: true`


