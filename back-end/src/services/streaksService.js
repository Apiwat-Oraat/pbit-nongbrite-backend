import prisma from "../lib/prismaClient.js"

/**
 * helper: เช็คว่าวันเดียวกันหรือไม่ (อิงเวลา Asia/Bangkok)
 */
function isSameDay(d1, d2) {
  try {
    const fmt = (d) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
    return fmt(d1) === fmt(d2);
  } catch (err) {
    console.warn("[isSameDay] Intl failed, using UTC+7 fallback:", err.message);
    const offset = 7 * 60 * 60 * 1000;
    const t1 = new Date(d1.getTime() + offset);
    const t2 = new Date(d2.getTime() + offset);
    return (
      t1.getUTCFullYear() === t2.getUTCFullYear() &&
      t1.getUTCMonth() === t2.getUTCMonth() &&
      t1.getUTCDate() === t2.getUTCDate()
    );
  }
}

/**
 * helper: เช็คว่า d1 เป็นวันถัดไปของ d2 หรือไม่ (อิงเวลา Asia/Bangkok)
 */
function isNextDay(d1, d2) {
  try {
    const fmt = (d) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
    const day1 = new Date(fmt(d1) + 'T00:00:00+07:00');
    const day2 = new Date(fmt(d2) + 'T00:00:00+07:00');
    const diff = day1.getTime() - day2.getTime();
    return diff === 24 * 60 * 60 * 1000;
  } catch (err) {
    console.warn("[isNextDay] Intl failed, using UTC+7 fallback:", err.message);
    const offset = 7 * 60 * 60 * 1000;
    const t1 = new Date(d1.getTime() + offset);
    const t2 = new Date(d2.getTime() + offset);
    t1.setUTCHours(0, 0, 0, 0);
    t2.setUTCHours(0, 0, 0, 0);
    const diff = t1.getTime() - t2.getTime();
    return diff === 24 * 60 * 60 * 1000;
  }
}

async function updateStreak(userId) {
  let state = await prisma.playerState.findUnique({ where: { userId } });
  const now = new Date();

  let current = 1;
  let longest = 1;

  if (!state) {
    // สร้าง PlayerState ใหม่
    state = await prisma.playerState.create({
      data: {
        userId,
        streakCurrent: 1,
        streakLongest: 1,
        lastActiveDate: now,
      },
    });
    current = 1;
    longest = 1;
  } else {
    // ตรวจสอบว่าเล่นวันเดียวกันหรือไม่
    if (state.lastActiveDate && isSameDay(now, state.lastActiveDate)) {
      // เล่นวันเดียวกัน → ไม่อัปเดต
      current = state.streakCurrent;
      longest = state.streakLongest;
    } else {
      // ตรวจสอบว่าเป็นวันถัดไปหรือไม่
      if (state.lastActiveDate && isNextDay(now, state.lastActiveDate)) {
        // วันถัดไป → เพิ่ม streak
        current = state.streakCurrent + 1;
      } else {
        // ข้ามวัน → reset streak
        current = 1;
      }

      longest = Math.max(current, state.streakLongest);

      // อัปเดต PlayerState
      state = await prisma.playerState.update({
        where: { userId },
        data: {
          streakCurrent: current,
          streakLongest: longest,
          lastActiveDate: now,
        },
      });
    }
  }

  return {
    current: state.streakCurrent,
    longest: state.streakLongest,
    lastActiveDate: state.lastActiveDate,
  };
}

async function getStreak(userId) {
  const state = await prisma.playerState.findUnique({ where: { userId } });
  if (!state) return null;
  return {
    current: state.streakCurrent,
    longest: state.streakLongest,
    lastActiveDate: state.lastActiveDate,
  };
}

export default {
  updateStreak,
  getStreak,
};
