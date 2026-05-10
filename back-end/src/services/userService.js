import prisma from "../lib/prismaClient.js"
import RankingCacheService from "./rankingCacheService.js"

const userService = {
  /**
   * ดึงข้อมูล profile ของ user
   * @param {number} userId - User ID
   * @returns {Object} User และ Profile
   */
async getProfile(userId) {

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      playerState: true,
      ranking: {
        select: { rank: true }
      }
    }
  });

  if (!user) {
    throw new Error("User not found");
  }

  const streaks = {
    currentStreak: user.playerState?.streakCurrent ?? 0,
    longestStreak: user.playerState?.streakLongest ?? 0
  };

  const stats = {
    totalScore: user.playerState?.totalScore ?? 0,
    totalStars: user.playerState?.totalStars ?? 0
  }

  const life = {
    lifeCurrent: user.playerState?.lifeCurrent ?? 0
  };

  const cacheRank = user.ranking?.rank;

  // Sync Rank
  if (user.profile && cacheRank !== undefined) {

    if (user.profile.currentRank !== cacheRank) {

      await prisma.profile.update({
        where: { userId },
        data: { currentRank: cacheRank }
      });

      user.profile.currentRank = cacheRank;
    }

  } else if (user.profile && !user.ranking) {

    try {

      const score = user.playerState?.totalScore ?? 0;
      const stars = user.playerState?.totalStars ?? 0;

      const cacheResult = await RankingCacheService.updateUserCache(
        userId,
        score,
        stars,
        user.playerState?.updatedAt || user.profile.updatedAt
      );

      await prisma.profile.update({
        where: { userId },
        data: { currentRank: cacheResult.rank }
      });

      user.profile.currentRank = cacheResult.rank;

    } catch (err) {
      console.error("Failed to sync ranking:", err);
    }
  }

  return {
    id: user.id,
    name: user.name,
    age: user.age,
    gender: user.gender,
    profile: user.profile,
    rank: user.profile?.currentRank ?? null,
    streaks,
    life,
    stats
  };
},
  /**
   * อัปเดตข้อมูล profile ของ user
   * @param {number} userId - User ID
   * @param {Object} data - ข้อมูลที่จะอัปเดต { name?, age?, gender?, icon? }
   * @returns {Object} User และ Profile ที่อัปเดตแล้ว
   */
  async updateProfile(userId, data) {
    const { name, age, gender, icon } = data;

    // สร้าง object สำหรับอัปเดต User
    const userUpdateData = {};
    if (name !== undefined) userUpdateData.name = name;
    if (age !== undefined) userUpdateData.age = age;
    if (gender !== undefined) userUpdateData.gender = gender;

    // สร้าง object สำหรับอัปเดต Profile
    const profileUpdateData = {};
    if (icon !== undefined) profileUpdateData.icon = icon;
    // ถ้า name เปลี่ยน ให้อัปเดต playerName ใน Profile ด้วย
    if (name !== undefined) profileUpdateData.playerName = name;

    // อัปเดต User (ถ้ามีข้อมูลที่จะอัปเดต)
    if (Object.keys(userUpdateData).length > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: userUpdateData
      });
    }

    // อัปเดต Profile (ถ้ามีข้อมูลที่จะอัปเดต)
    if (Object.keys(profileUpdateData).length > 0) {
      await prisma.profile.upsert({
        where: { userId },
        update: profileUpdateData,
        create: {
          userId,
          ...profileUpdateData
        }
      });
    }

    // ดึงข้อมูลล่าสุด
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });

    return updatedUser;
  }

}


export default userService;