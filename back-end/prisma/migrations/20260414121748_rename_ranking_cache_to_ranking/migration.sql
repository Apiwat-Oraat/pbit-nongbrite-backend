/*
  Warnings:

  - You are about to drop the `RankingCache` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "RankingCache" DROP CONSTRAINT "RankingCache_userId_fkey";

-- DropTable
DROP TABLE "RankingCache";

-- CreateTable
CREATE TABLE "Ranking" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ranking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ranking_userId_key" ON "Ranking"("userId");

-- CreateIndex
CREATE INDEX "Ranking_rank_idx" ON "Ranking"("rank");

-- CreateIndex
CREATE INDEX "Ranking_points_idx" ON "Ranking"("points" DESC);

-- AddForeignKey
ALTER TABLE "Ranking" ADD CONSTRAINT "Ranking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
