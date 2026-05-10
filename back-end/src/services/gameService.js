import { calculateRank } from "../utils/rankSystem.js";
import RankingCacheService from "./rankingCacheService.js";
import streaksService from "./streaksService.js";
import prisma from "../lib/prismaClient.js"

const GameService = {

  // =========================================
  // ฟังก์ชันที่ 1: ส่งผลการเล่น (Submit)
  // =========================================
  async submitLevelResult(userId, levelId, score, stars, playTime) {

    // 1. ตรวจสอบว่ามีด่านนี้จริงไหม
    const level = await prisma.gameLevel.findUnique({
      where: { id: levelId }
    });

    if (!level) throw new Error("level not found");

    // 2. ดึง best record เดิม (ถ้ามี)
    const existingBest = await prisma.gameProgress.findFirst({
      where: { userId, levelId, isBest: true }
    });

    const isPassed = stars > 0;

    if (!existingBest) {
      // ยังไม่เคยเล่นด่านนี้ → สร้าง record ใหม่เป็น best
      await prisma.gameProgress.create({
        data: {
          userId,
          levelId,
          score,
          stars,
          playTime,
          isBest: true,
          attempts: 1
        }
      });
    } else {
      // เคยเล่นแล้ว → บันทึกประวัติใหม่
      const isBetterScore = score > existingBest.score;
      const isBetterStars = stars > existingBest.stars;
      const isBetter = isBetterScore || isBetterStars;

      if (isBetter) {
        // คะแนนดีกว่า → ยกเลิก best เดิม, ตั้ง record ใหม่เป็น best
        await prisma.gameProgress.update({
          where: { id: existingBest.id },
          data: { isBest: false }
        });

        await prisma.gameProgress.create({
          data: {
            userId,
            levelId,
            score,
            stars: Math.max(stars, existingBest.stars), // เก็บดาวสูงสุด
            playTime,
            isBest: true,
            attempts: existingBest.attempts + 1
          }
        });
      } else {
        // คะแนนไม่ดีกว่า → บันทึกประวัติธรรมดา + เพิ่ม attempts ใน best
        await prisma.gameProgress.create({
          data: {
            userId,
            levelId,
            score,
            stars,
            playTime,
            isBest: false,
            attempts: existingBest.attempts + 1
          }
        });

        // อัปเดต attempts ใน best record
        await prisma.gameProgress.update({
          where: { id: existingBest.id },
          data: { attempts: existingBest.attempts + 1 }
        });
      }
    }

    // 3. อัปเดต PlayerState (Score & Stars)
    const aggregations = await prisma.gameProgress.aggregate({
      _sum: {
        score: true,
        stars: true
      },
      where: { userId, isBest: true }
    });

    const totalScore = aggregations._sum.score || 0;
    const totalStars = aggregations._sum.stars || 0;

    const newRankInfo = calculateRank(totalScore);

    // ดึงข้อมูลเก่าก่อนอัปเดต (เพื่อ update cache)
    const oldPlayerState = await prisma.playerState.findUnique({
      where: { userId },
      select: {
        totalScore: true,
        totalStars: true,
        updatedAt: true
      }
    });

    // ถ้ายังไม่มี PlayerState → สร้างใหม่
    if (!oldPlayerState) {
      await prisma.playerState.create({
        data: { userId, totalScore: 0, totalStars: 0 }
      });
    }

    const oldScore = oldPlayerState?.totalScore || 0;
    const oldTotalStars = oldPlayerState?.totalStars || 0;
    const oldUpdatedAt = oldPlayerState?.updatedAt || new Date();

    // อัปเดต RankingCache
    let rankingPosition = null;
    if (totalScore !== oldScore || totalStars !== oldTotalStars) {
      try {
        const cacheResult = await RankingCacheService.updateUserCache(userId, totalScore, totalStars, oldUpdatedAt);
        rankingPosition = cacheResult.rank;
      } catch (err) {
        console.error('Failed to update ranking cache:', err);
        rankingPosition = await prisma.playerState.count({
          where: {
            totalScore: { gt: totalScore }
          }
        }) + 1;
      }
    } else {
      const existingCache = await prisma.rankingCache.findUnique({
        where: { userId },
        select: { rank: true }
      });

      if (existingCache) {
        rankingPosition = existingCache.rank;
      } else {
        try {
          const cacheResult = await RankingCacheService.updateUserCache(userId, totalScore, totalStars, oldUpdatedAt);
          rankingPosition = cacheResult.rank;
        } catch (err) {
          console.error('Failed to create ranking cache:', err);
          rankingPosition = await prisma.playerState.count({
            where: {
              totalScore: { gt: totalScore }
            }
          }) + 1;
        }
      }
    }

    // อัปเดต PlayerState (Score & Stars)
    await prisma.playerState.upsert({
      where: { userId },
      update: {
        totalScore: totalScore,
        totalStars: totalStars,
        updatedAt: new Date()
      },
      create: {
        userId,
        totalScore: totalScore,
        totalStars: totalStars,
      }
    });

    // อัปเดต Profile (Current Rank)
    await prisma.profile.update({
      where: { userId },
      data: {
        currentRank: rankingPosition,
        updatedAt: new Date()
      }
    });

    // 4. อัปเดต Streak (async - ไม่ต้องรอ)
    streaksService.updateStreak(userId)
      .catch(err => {
        console.error('Failed to update streak:', err);
      });

    return {
      success: true,
      earnedScore: score,
      totalScore: totalScore,
      rank: newRankInfo.name,
      rankLabel: newRankInfo.label
    };
  },

  // =========================================
  // ฟังก์ชันที่ 2: ดึงอันดับ (Ranking)
  // =========================================
  

async getLeaderboard(useCache = true) {
const LEADERBOARD_LIMIT = 10;
  if (useCache) {
    try {
      const cachedLeaderboard =
        await RankingCacheService.getLeaderboardFromCache(LEADERBOARD_LIMIT);

      if (!cachedLeaderboard || cachedLeaderboard.length === 0) {
        return this.getLeaderboard(false);
      }

      const userIds = cachedLeaderboard.map(p => p.userId);

      const [playerStates, users] = await Promise.all([
        prisma.playerState.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true, totalStars: true }
        }),
        prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, gender: true }
        })
      ]);

      const statsMap = new Map(playerStates.map(s => [s.userId, s]));
      const genderMap = new Map(users.map(u => [u.id, u.gender]));

      return cachedLeaderboard.map(player => {
        const stats = statsMap.get(player.userId);
        const rankInfo = calculateRank(player.totalScore);

        return {
          rank: player.rank,
          userId: player.userId,
          name: player.name,
          avatar: player.avatar,
          gender: genderMap.get(player.userId) || null,
          totalScore: player.totalScore,
          totalStars: stats?.totalStars || 0,
          tier: rankInfo.name,
          tierLabel: rankInfo.label,
          tierIcon: rankInfo.icon
        };
      });

    } catch (error) {
      console.error("Cache failed → fallback:", error);
      return this.getLeaderboard(false);
    }
  }

  const leaderboardStats = await prisma.playerState.findMany({
    take: LEADERBOARD_LIMIT,
    orderBy: [
      { totalScore: "desc" },
      { totalStars: "desc" },
      { updatedAt: "asc" }
    ],
    include: {
      user: { include: { profile: true } }
    }
  });

  return leaderboardStats.map((state, index) => {
    const rankInfo = calculateRank(state.totalScore);
    const profile = state.user.profile;

    return {
      rank: index + 1,
      userId: state.userId,
      name: profile?.playerName || state.user.name || "Unknown Hero",
      avatar: profile?.icon,
      gender: state.user.gender || null,
      totalScore: state.totalScore,
      totalStars: state.totalStars,
      tier: rankInfo.name,
      tierLabel: rankInfo.label,
      tierIcon: rankInfo.icon
    };
  });
}
  // async getLeaderboard(useCache = true) {
  //   // ใช้ RankingCache เพื่อเพิ่มประสิทธิภาพ
  //   if (useCache) {
  //     try {
  //       const cachedLeaderboard = await RankingCacheService.getLeaderboardFromCache(10);

  //       // ดึง totalStars จาก PlayerState
  //       const userIds = cachedLeaderboard.map(p => p.userId);
  //       const allPlayerStates = await prisma.playerState.findMany({
  //         where: { userId: { in: userIds } },
  //         select: {
  //           userId: true,
  //           totalStars: true
  //         }
  //       });

  //       const statsMap = new Map(allPlayerStates.map(s => [s.userId, s]));

  //       return cachedLeaderboard.map((player) => {
  //         const stats = statsMap.get(player.userId);
  //         const rankInfo = calculateRank(player.totalScore);

  //         return {
  //           rank: player.rank,
  //           userId: player.userId,
  //           name: player.name,
  //           avatar: player.avatar,

  //           totalScore: player.totalScore,
  //           totalStars: stats?.totalStars || 0,

  //           tier: rankInfo.name,
  //           tierLabel: rankInfo.label,
  //           tierIcon: rankInfo.icon
  //         };
  //       });
  //     } catch (error) {
  //       console.error('Error fetching from cache, falling back:', error);
  //       return this.getLeaderboard(false);
  //     }
  //   }

  //   // Fallback: Query จาก PlayerState + Profile
  //   const leaderboardStats = await prisma.playerState.findMany({
  //     take: 10,
  //     orderBy: [
  //       { totalScore: 'desc' },
  //       { totalStars: 'desc' },
  //       { updatedAt: 'asc' }
  //     ],
  //     include: {
  //       user: {
  //         include: { profile: true }
  //       }
  //     }
  //   });

  //   return leaderboardStats.map((state, index) => {
  //     const rankInfo = calculateRank(state.totalScore);
  //     const profile = state.user.profile;

  //     return {
  //       rank: index + 1,
  //       userId: state.userId,
  //       name: profile?.playerName || state.user.name || "Unknown Hero",
  //       icon: profile?.icon,

  //       totalScore: state.totalScore,
  //       totalStars: state.totalStars,

  //       tier: rankInfo.name,
  //       tierLabel: rankInfo.label,
  //       tierIcon: rankInfo.icon
  //     };
  //   });
  // },

};

export default GameService;