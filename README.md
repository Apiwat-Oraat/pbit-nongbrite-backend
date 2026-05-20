# P'Bit Nong'Brite Learning Platform

> Backend setup ล่าสุดอยู่ที่ [BACKEND_INSTALLATION.md](./BACKEND_INSTALLATION.md)

## 🧰 Tech Stack

<img width="1154" height="512" alt="tech stack diagram drawio" src="https://github.com/user-attachments/assets/273d0d3a-735d-48a1-8a6b-eb1faf87e199" />

- **Backend**: Node.js + Express 5 + Prisma ORM + JWT + Nodemailer
- **Database**: PostgreSQL 16
- **Infrastructure**: Docker, Docker Compose, Prisma migrations
- **Auth & Security**: bcrypt hashing, HTTP-only cookies, token rotation, role enum
  
## 🎯 Concept

แพลตฟอร์มช่วยฝึกฝนทักษะผ่านรูปแบบเกม (game-based learning) ที่แบ่งคอนเทนต์เป็น Chapter → Level พร้อมระบบหัวใจ (Lives), สถิติการเล่น, สะสมดาว/คะแนน, ดึงดูดผู้ใช้ด้วย Streak และ Achievements รวมถึงการจัดอันดับด้วย Ranking cache ทำให้ผู้เรียนเห็นพัฒนาการของตัวเองแบบเรียลไทม์

- **ผู้ใช้ (Learner)** สมัครสมาชิกแบบสองขั้น, มีโปรไฟล์, สะสมคะแนนดาว และจดบันทึกประวัติการเล่น
- **เนื้อหา (Chapter & Level)** จัดเรียงตามความยากและมี max score/stars สำหรับวัดผล
- **เกมเพลย์ (GamePlayHistory + LevelCompletion)** เก็บทุกครั้งที่เล่น รวมถึง best score/best time
- **Gamification Layer**: lives, streaks, achievements, icons, ranking ช่วยเพิ่ม retention

## 🛣️ API Structure (`/api/v1`)

### Health Check
| Method | Endpoint | Description | Auth |
| ------ | -------- | ----------- | ---- |
| GET | `/health` | ตรวจสอบสถานะ server | ❌ |

### Authentication
| Method | Endpoint | Description | Auth |
| ------ | -------- | ----------- | ---- |
| POST | `/auth/login` | อีเมล+รหัสเพื่อรับ access/refresh token (cookie) | ❌ |
| POST | `/auth/logout` | ล้าง cookie + refresh token | ✅ (cookie) |
| POST | `/auth/refresh` | ออก access token ใหม่จาก refresh token | ✅ (cookie) |
| POST | `/auth/register/step1` | ส่ง email/password รับ register token | ❌ |
| POST | `/auth/register/step2` | ส่ง profile data พร้อม register token ใน cookie | ✅ (register cookie) |
| POST | `/auth/forgot-password` | ส่ง PIN รีเซ็ตรหัส (idempotent) | ❌ |
| POST | `/auth/reset-password` | รีเซ็ตรหัสด้วย email + PIN + new password | ❌ |

### User Profile
| Method | Endpoint | Description | Auth |
| ------ | -------- | ----------- | ---- |
| GET | `/user/profile` | ดึงข้อมูล profile ของ user | ✅ |
| PUT | `/user/profile` | อัปเดต profile (name, age, gender, icon) | ✅ |

### Lives Management
| Method | Endpoint | Description | Auth |
| ------ | -------- | ----------- | ---- |
| GET | `/users/lives` | ดูจำนวนหัวใจคงเหลือ (auto reset รายวัน) | ✅ |
| PUT | `/users/lives` | ใช้หัวใจ 1 ดวงเมื่อเล่นเกม | ✅ |
| PUT | `/users/lives/reset` | รีเซ็ตหัวใจกลับเต็ม | ✅ |

### Streak
| Method | Endpoint | Description | Auth |
| ------ | -------- | ----------- | ---- |
| GET | `/users/streak` | ดู streak ปัจจุบัน/สูงสุด | ✅ |
| PUT | `/users/streak/update` | อัปเดต streak เมื่อเล่นในวันใหม่ | ✅ |

### Chapters
| Method | Endpoint | Description | Auth |
| ------ | -------- | ----------- | ---- |
| GET | `/chapters` | ดึงรายการ chapter + level ที่ active | ✅ |
| GET | `/chapters/progress` | ดึง chapters พร้อม progress (stars, levelsPassed) | ✅ |
| GET | `/chapters/:chapterId` | ดึงรายละเอียด chapter เดียว | ✅ |

### Game
| Method | Endpoint | Description | Auth |
| ------ | -------- | ----------- | ---- |
| GET | `/game/ranking` | ดึง leaderboard/ranking จาก cache | ✅ |
| GET | `/game/last-stage` | ดึงด่านล่าสุดที่ user เล่น (chapter, level, score, stars) | ✅ |
| POST | `/game/submit` | บันทึกผลเล่น level (score/stars/time) | ✅ |
| POST | `/game/rebuild-cache` | Rebuild ranking cache ทั้งหมด (admin) | ✅ |

> ทุก endpoint ที่ต้องยืนยันตัวตนใช้ `authMiddleware.verifyToken` ตรวจสอบ access token จาก HTTP-only cookie

## ✨ Features

- **Secure onboarding**: สมัคร 2 ขั้นพร้อม register token, JWT access+refresh ด้วย rotation, logout เคลียร์ทันที
- **User profile management**: แก้ไข name, age, gender, icon ผ่าน API
- **Gamified progression**: Chapter/Level, best score/stars/time, ประวัติการเล่น, last stage tracking
- **Progress tracking**: ดึง chapters พร้อม progress (stars earned, levels passed, completion %)
- **Lives management**: quota รายวัน, ตรวจ reset อัตโนมัติ, error `NO_LIVES_LEFT`
- **Daily streak engine**: ตรวจ same-day/next-day อัตโนมัติ, เก็บ longest streak, sync กับ Profile
- **Ranking system**: Leaderboard พร้อม RankingCache สำหรับ performance ที่ดีขึ้น
- **Email recovery**: ส่ง PIN 6 หลักผ่าน Nodemailer, token หมดอายุใน 10 นาที
- **Prisma + PostgreSQL schema**: strongly typed models, enum, composite index/unique constraints, cascade delete
- **Docker-first**: Postgres, backend, (frontend stub) จัดการด้วย `docker compose`
