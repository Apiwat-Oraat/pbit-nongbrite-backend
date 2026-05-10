import prisma from "../lib/prismaClient.js"

const chapterService = {

  /**
   * ดึง Chapter ทั้งหมดพร้อม Level (Group จาก GameLevel by chapterNo)
   */
  async getAllChapters(userId = null) {
    const levels = await prisma.gameLevel.findMany({
      where: { isActive: true },
      orderBy: [{ chapterNo: 'asc' }, { levelNo: 'asc' }],
      select: {
        id: true,
        chapterNo: true,
        levelNo: true,
        title: true,
        desc: true,
        images: true,
        maxStars: true,
        difficulty: true,
        // ดึง best progress ถ้ามี userId
        ...(userId && {
          progress: {
            where: { userId, isBest: true },
            select: {
              stars: true
            },
            take: 1
          }
        })
      }
    });

    // Group levels by chapterNo
    const chapterMap = new Map();
    for (const level of levels) {
      if (!chapterMap.has(level.chapterNo)) {
        chapterMap.set(level.chapterNo, {
          chapterNo: level.chapterNo,
          // ใช้ข้อมูลจาก level แรกของ chapter เป็น chapter info
          title: level.title,
          desc: level.desc,
          images: level.images,
          levels: []
        });
      }

      const earnedStars = level.progress?.[0]?.stars || 0;
      const { progress, images, desc: levelDesc, ...levelData } = level;

      chapterMap.get(level.chapterNo).levels.push({
        ...levelData,
        earnedStars
      });
    }

    const chapters = Array.from(chapterMap.values());

    // เพิ่ม isUnlocked status ถ้ามี userId
    if (userId) {
      return await this.addUnlockedStatus(chapters, userId);
    }

    return chapters;
  },

  /**
   * ดึง Chapter เดียวตาม chapterNo
   */
  async getChapterById(chapterNo, userId = null) {
    const levels = await prisma.gameLevel.findMany({
      where: { chapterNo, isActive: true },
      orderBy: { levelNo: 'asc' },
      select: {
        id: true,
        chapterNo: true,
        levelNo: true,
        title: true,
        desc: true,
        images: true,
        maxScore: true,
        maxStars: true,
        difficulty: true
      }
    });

    if (levels.length === 0) {
      throw new Error("Chapter not found");
    }

    const chapter = {
      chapterNo,
      title: levels[0].title,
      desc: levels[0].desc,
      images: levels[0].images,
      levels: levels.map(({ images, ...level }) => level)
    };

    // ถ้ามี userId ให้คำนวณ unlocked status
    if (userId) {
      const chapters = await this.addUnlockedStatus([chapter], userId);
      return chapters[0];
    }

    return chapter;
  },

  /**
   * เพิ่ม unlocked status ให้กับ levels
   * Logic:
   * - Level แรกของ Chapter แรก = unlocked ตั้งแต่เริ่มต้น
   * - Level ถัดไป = unlocked เมื่อผ่าน level ก่อนหน้า (stars > 0 ใน isBest record)
   * - Level แรกของ Chapter ถัดไป = unlocked เมื่อผ่าน level สุดท้ายของ chapter ก่อนหน้า
   */
  async addUnlockedStatus(chapters, userId) {
    // ดึง best progress ของ user ทั้งหมด
    const completions = await prisma.gameProgress.findMany({
      where: { userId, isBest: true },
      select: {
        levelId: true,
        stars: true
      }
    });


    // สร้าง map สำหรับเช็คว่า level ไหนผ่านแล้ว (stars > 0)
    const completedLevels = new Set(
      completions
        .filter(c => c.stars > 0)
        .map(c => c.levelId)
    );

    return chapters.map((chapter, chapterIndex) => {
      const levels = chapter.levels.map((level, index) => {
        let isUnlocked = false;

        if (chapterIndex === 0 && index === 0) {
          // Level แรกของ Chapter แรก = unlocked ตั้งแต่เริ่มต้น
          isUnlocked = true;
        } else if (index === 0) {
          // Level แรกของ Chapter ถัดไป = unlocked เมื่อผ่าน level สุดท้ายของ chapter ก่อนหน้า
          const prevChapter = chapters[chapterIndex - 1];
          if (prevChapter && prevChapter.levels.length > 0) {
            const lastLevelOfPrevChapter = prevChapter.levels[prevChapter.levels.length - 1];
            isUnlocked = completedLevels.has(lastLevelOfPrevChapter.id);
          }
        } else {
          // Level ถัดไป = unlocked เมื่อผ่าน level ก่อนหน้าทั้งหมด
          let allPreviousLevelsCompleted = true;
          for (let i = 0; i < index; i++) {
            const prevLevel = chapter.levels[i];
            if (!completedLevels.has(prevLevel.id)) {
              allPreviousLevelsCompleted = false;
              break;
            }
          }
          isUnlocked = allPreviousLevelsCompleted;
        }

        return {
          ...level,
          isUnlocked
        };
      });

      return {
        ...chapter,
        levels
      };
    });
  },


  // =========================================
  // ฟังก์ชัน: ดึงรายชื่อ Chapter พร้อมดาวที่ทำได้
  // =========================================
  async getChaptersWithProgress(userId) {
    // 1. ดึง GameLevel ทั้งหมด + best progress ของ User
    const levels = await prisma.gameLevel.findMany({
      where: { isActive: true },
      orderBy: [{ chapterNo: 'asc' }, { levelNo: 'asc' }],
      select: {
        id: true,
        chapterNo: true,
        levelNo: true,
        title: true,
        desc: true,
        images: true,
        maxStars: true,
        progress: {
          where: { userId, isBest: true },
          select: { stars: true }
        }
      }
    });

    // 2. Group by chapterNo แล้วคำนวณดาว
    const chapterMap = new Map();

    for (const level of levels) {
      if (!chapterMap.has(level.chapterNo)) {
        chapterMap.set(level.chapterNo, {
          chapterNo: level.chapterNo,
          title: level.title,
          desc: level.desc,
          images: level.images,
          earnedStars: 0,
          totalMaxStars: 0,
          levelsPassed: 0,
          totalLevels: 0
        });
      }

      const chapter = chapterMap.get(level.chapterNo);
      chapter.totalMaxStars += level.maxStars;
      chapter.totalLevels += 1;

      const userProgress = level.progress?.[0];
      if (userProgress && userProgress.stars > 0) {
        chapter.earnedStars += userProgress.stars;
        chapter.levelsPassed += 1;
      }
    }

    // 3. Format output
    const formattedChapters = Array.from(chapterMap.values()).map(chapter => {
      const progressPercent = chapter.totalMaxStars > 0
        ? Math.round((chapter.earnedStars / chapter.totalMaxStars) * 100)
        : 0;

      return {
        chapterNo: chapter.chapterNo,
        title: chapter.title,
        desc: chapter.desc,
        images: chapter.images,

        stars: {
          earned: chapter.earnedStars,
          total: chapter.totalMaxStars,
          percent: progressPercent
        },

        levelsPassed: chapter.levelsPassed,
        totalLevels: chapter.totalLevels,
        isCompleted: chapter.levelsPassed === chapter.totalLevels && chapter.totalLevels > 0
      };
    });

    return formattedChapters;
  }
}

export default chapterService;
