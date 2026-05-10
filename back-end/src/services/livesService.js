import prisma from "../lib/prismaClient.js";

// ค่าคงที่ (ถ้าอนาคตเปลี่ยนจาก 5 → 10 lives, ปรับตรงนี้)
const MAX_LIVES = 5;

/**
 * ดึงข้อมูลหัวใจของ user (จาก PlayerState)
 */
async function getLives(userId) {
  let state = await prisma.playerState.findUnique({
    where: { userId },
  });

  const now = new Date();

  if (!state) {
    // ถ้ายังไม่มี record → สร้างใหม่ (คืนค่าได้เลย ไม่ต้องลงไปเช็ค isSameDay ต่อ)
    state = await prisma.playerState.create({
      data: {
        userId,
        lifeCurrent: MAX_LIVES,
        lifeMax: MAX_LIVES,
        lastLifeReset: now,
      },
    });
    return {
      current: state.lifeCurrent,
      max: state.lifeMax,
      lastResetAt: state.lastLifeReset,
    };
  }

  // เช็คว่า reset วันใหม่หรือยัง
  const lastReset = state.lastLifeReset;

  if (!lastReset || !isSameDay(now, lastReset)) {
    state = await prisma.playerState.update({
      where: { userId },
      data: {
        lifeCurrent: MAX_LIVES,
        lastLifeReset: now,
      },
    });
  }

  return {
    current: state.lifeCurrent,
    max: state.lifeMax,
    lastResetAt: state.lastLifeReset,
  };
}

/**
 * ใช้หัวใจ 1 ดวง
 */
async function useLife(userId) {

  const life = await getLives(userId);

  if (life.current <= 0) {
    throw new Error("NO_LIVES_LEFT");
  }

  const updated = await prisma.playerState.update({
    where: { userId },
    data: {
      lifeCurrent: { decrement: 1 },
    },
  });

  if (updated.lifeCurrent < 0) {
    const fixed = await prisma.playerState.update({
      where: { userId },
      data: { lifeCurrent: 0 }
    });
    return {
      current: fixed.lifeCurrent,
      max: fixed.lifeMax,
      lastResetAt: fixed.lastLifeReset,
    };
  }

  return {
    current: updated.lifeCurrent,
    max: updated.lifeMax,
    lastResetAt: updated.lastLifeReset,
  }
}


/**
 * รีเซ็ตหัวใจ (force reset เช่น admin หรือกรณีพิเศษ)
 */
async function resetLives(userId) {
  let state = await prisma.playerState.findUnique({
    where: { userId },
  });

  if (!state) {
    // ถ้า user นี้ยังไม่มี PlayerState → สร้างใหม่พร้อม reset เลย
    state = await prisma.playerState.create({
      data: {
        userId,
        lifeCurrent: MAX_LIVES,
        lifeMax: MAX_LIVES,
        lastLifeReset: new Date(),
      },
    });
  } else {
    // ถ้ามีแล้ว → reset ให้เต็ม
    state = await prisma.playerState.update({
      where: { userId },
      data: {
        lifeCurrent: MAX_LIVES,
        lastLifeReset: new Date(),
      },
    });
  }

  return {
    current: state.lifeCurrent,
    max: state.lifeMax,
    lastResetAt: state.lastLifeReset,
  };
}

/**
 * helper: เช็คว่าวันเดียวกันหรือไม่ (อิงเวลา Asia/Bangkok ของไทย)
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

export default {
  getLives,
  useLife,
  resetLives,
};
