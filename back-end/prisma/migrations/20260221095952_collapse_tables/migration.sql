/*
  Warnings:

  - You are about to drop the `Chapter` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GamePlayHistory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LastStage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Level` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LevelCompletion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Life` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Streak` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserStats` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "GamePlayHistory" DROP CONSTRAINT "GamePlayHistory_levelId_fkey";

-- DropForeignKey
ALTER TABLE "GamePlayHistory" DROP CONSTRAINT "GamePlayHistory_userId_fkey";

-- DropForeignKey
ALTER TABLE "LastStage" DROP CONSTRAINT "LastStage_chapterId_fkey";

-- DropForeignKey
ALTER TABLE "LastStage" DROP CONSTRAINT "LastStage_levelId_fkey";

-- DropForeignKey
ALTER TABLE "LastStage" DROP CONSTRAINT "LastStage_userId_fkey";

-- DropForeignKey
ALTER TABLE "Level" DROP CONSTRAINT "Level_chapterId_fkey";

-- DropForeignKey
ALTER TABLE "LevelCompletion" DROP CONSTRAINT "LevelCompletion_levelId_fkey";

-- DropForeignKey
ALTER TABLE "LevelCompletion" DROP CONSTRAINT "LevelCompletion_userId_fkey";

-- DropForeignKey
ALTER TABLE "Life" DROP CONSTRAINT "Life_userId_fkey";

-- DropForeignKey
ALTER TABLE "Streak" DROP CONSTRAINT "Streak_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserStats" DROP CONSTRAINT "UserStats_userId_fkey";

-- DropTable
DROP TABLE "Chapter";

-- DropTable
DROP TABLE "GamePlayHistory";

-- DropTable
DROP TABLE "LastStage";

-- DropTable
DROP TABLE "Level";

-- DropTable
DROP TABLE "LevelCompletion";

-- DropTable
DROP TABLE "Life";

-- DropTable
DROP TABLE "Streak";

-- DropTable
DROP TABLE "UserStats";

-- CreateTable
CREATE TABLE "GameLevel" (
    "id" SERIAL NOT NULL,
    "chapterNo" INTEGER NOT NULL,
    "levelNo" INTEGER NOT NULL,
    "title" JSONB NOT NULL,
    "desc" JSONB,
    "images" JSONB,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "maxStars" INTEGER NOT NULL DEFAULT 3,
    "maxScore" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameProgress" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "levelId" INTEGER NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "playTime" INTEGER NOT NULL DEFAULT 0,
    "isBest" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerState" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "totalStars" INTEGER NOT NULL DEFAULT 0,
    "lifeCurrent" INTEGER NOT NULL DEFAULT 5,
    "lifeMax" INTEGER NOT NULL DEFAULT 5,
    "lastLifeReset" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "streakCurrent" INTEGER NOT NULL DEFAULT 0,
    "streakLongest" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameLevel_chapterNo_idx" ON "GameLevel"("chapterNo");

-- CreateIndex
CREATE UNIQUE INDEX "GameLevel_chapterNo_levelNo_key" ON "GameLevel"("chapterNo", "levelNo");

-- CreateIndex
CREATE INDEX "GameProgress_userId_levelId_playedAt_idx" ON "GameProgress"("userId", "levelId", "playedAt" DESC);

-- CreateIndex
CREATE INDEX "GameProgress_userId_isBest_idx" ON "GameProgress"("userId", "isBest");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerState_userId_key" ON "PlayerState"("userId");

-- CreateIndex
CREATE INDEX "PlayerState_totalScore_idx" ON "PlayerState"("totalScore" DESC);

-- CreateIndex
CREATE INDEX "PlayerState_totalStars_idx" ON "PlayerState"("totalStars" DESC);

-- AddForeignKey
ALTER TABLE "GameProgress" ADD CONSTRAINT "GameProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameProgress" ADD CONSTRAINT "GameProgress_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "GameLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerState" ADD CONSTRAINT "PlayerState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
