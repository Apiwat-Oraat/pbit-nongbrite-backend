import prisma from "../lib/prismaClient.js";

/**
 * RankingCache Service
 * จัดการ cache ของ ranking เพื่อเพิ่มประสิทธิภาพการดึง leaderboard
 */
const RankingCacheService = {

  /**
   * อัปเดต cache ของ user หนึ่งคน
   * เรียกใช้เมื่อ user submit level หรือคะแนนเปลี่ยน
   */
  async updateUserCache(userId, totalScore, totalStars = null, updatedAt = null) {
    // คำนวณ rank ให้ตรงกับ leaderboard logic
    // Leaderboard เรียงตาม: totalScore DESC, totalStars DESC, updatedAt ASC

    // ดึง PlayerState ของ user นี้เพื่อเอา totalStars และ updatedAt (ถ้ายังไม่ได้ส่งมา)
    let userTotalStars = totalStars;
    let userUpdatedAt = updatedAt;

    if (userTotalStars === null || userUpdatedAt === null) {
      const playerState = await prisma.playerState.findUnique({
        where: { userId },
        select: {
          totalStars: true,
          updatedAt: true
        }
      });

      if (!playerState) {
        throw new Error("PlayerState not found");
      }

      if (userTotalStars === null) {
        userTotalStars = playerState.totalStars;
      }
      if (userUpdatedAt === null) {
        userUpdatedAt = playerState.updatedAt;
      }
    }

    // นับคนที่อยู่เหนือ user นี้ตาม leaderboard logic
    const rank = await prisma.playerState.count({
      where: {
        OR: [
          { totalScore: { gt: totalScore } },
          {
            AND: [
              { totalScore: totalScore },
              { totalStars: { gt: userTotalStars } }
            ]
          },
          {
            AND: [
              { totalScore: totalScore },
              { totalStars: userTotalStars },
              { updatedAt: { lt: userUpdatedAt } }
            ]
          }
        ]
      }
    }) + 1;

    // Upsert cache
    await prisma.ranking.upsert({
      where: { userId },
      update: {
        rank,
        points: totalScore,
        lastUpdated: new Date()
      },
      create: {
        userId,
        rank,
        points: totalScore
      }
    });

    return { rank, points: totalScore };
  },

  /**
   * อัปเดต rank ของทุกคนที่ได้รับผลกระทบ
   */
  async updateAffectedRanks(newScore, oldScore = 0) {
    const minScore = Math.min(newScore, oldScore);
    const maxScore = Math.max(newScore, oldScore);

    const affectedUsers = await prisma.playerState.findMany({
      where: {
        totalScore: {
          gte: minScore,
          lte: maxScore
        }
      },
      select: {
        userId: true,
        totalScore: true
      }
    });

    const updatePromises = affectedUsers.map(state =>
      this.updateUserCache(state.userId, state.totalScore)
    );

    await Promise.all(updatePromises);
  },

  /**
   * ดึง leaderboard จาก cache
   */
  async getLeaderboardFromCache(limit = 10) {
    const cachedLeaderboard = await prisma.ranking.findMany({
      take: limit,
      orderBy: [
        { points: 'desc' },
        { lastUpdated: 'asc' }
      ],
      include: {
        user: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    // Need profiles for name/icon
    const userIds = cachedLeaderboard.map(c => c.userId);
    const profiles = await prisma.profile.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, playerName: true, icon: true }
    });
    const profileMap = new Map(profiles.map(p => [p.userId, p]));

    return cachedLeaderboard.map((cache, index) => {
      const profile = profileMap.get(cache.userId);
      return {
        rank: index + 1,
        cacheRank: cache.rank,
        userId: cache.userId,
        name: profile?.playerName || cache.user.name || "Unknown Hero",
        avatar: profile?.icon,
        totalScore: cache.points,
        lastUpdated: cache.lastUpdated
      };
    });
  },

  /**
   * ดึง rank ของ user หนึ่งคนจาก cache
   */
  async getUserRank(userId) {
    const cache = await prisma.ranking.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            name: true,
          }
        }
      }
    });

    if (!cache) {
      // ถ้ายังไม่มี cache ให้สร้างใหม่
      const playerState = await prisma.playerState.findUnique({
        where: { userId }
      });

      if (!playerState) return null;

      const updated = await this.updateUserCache(userId, playerState.totalScore);

      const profile = await prisma.profile.findUnique({ where: { userId } });

      return {
        rank: updated.rank,
        points: updated.points,
        user: {
          name: profile?.playerName || profile?.user?.name,
          displayName: profile?.playerName,
          avatar: profile?.icon
        }
      };
    }

    const profile = await prisma.profile.findUnique({ where: { userId } });

    return {
      rank: cache.rank,
      points: cache.points,
      lastUpdated: cache.lastUpdated,
      user: {
        name: profile?.playerName || cache.user.name,
        displayName: profile?.playerName,
        avatar: profile?.icon
      }
    };
  },

  /**
   * Rebuild cache ทั้งหมด (ใช้เมื่อต้องการ sync ใหม่ทั้งหมด)
   */
  async rebuildAllCache() {
    console.log('🔄 Starting to rebuild ranking cache...');

    const allPlayerStates = await prisma.playerState.findMany({
      orderBy: [
        { totalScore: 'desc' },
        { totalStars: 'desc' },
        { updatedAt: 'asc' }
      ],
      select: {
        userId: true,
        totalScore: true,
        totalStars: true,
        updatedAt: true
      }
    });

    console.log(`📊 Found ${allPlayerStates.length} players to cache`);

    const batchSize = 100;
    let processed = 0;

    for (let i = 0; i < allPlayerStates.length; i += batchSize) {
      const batch = allPlayerStates.slice(i, i + batchSize);

      const updatePromises = batch.map(state =>
        this.updateUserCache(state.userId, state.totalScore, state.totalStars, state.updatedAt)
      );

      await Promise.all(updatePromises);
      processed += batch.length;
      console.log(`✅ Processed ${processed}/${allPlayerStates.length} players`);
    }

    console.log('✨ Ranking cache rebuild completed!');
    return { totalProcessed: processed };
  },

  /**
   * ลบ cache ของ user (ใช้เมื่อลบ user)
   */
  async deleteUserCache(userId) {
    await prisma.ranking.deleteMany({
      where: { userId }
    });
  }
};

export default RankingCacheService;
