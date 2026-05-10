import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient()

//
const gamesData = [
  {
    order: 1,
    title: { th: "เกมการนำทาง", en: "Path Navigation" },
    desc: {
      th: "ฝึกตรรกะการคิดเป็นลำดับขั้นตอน (Sequencing) การวางแผน และเข้าใจคำสั่งแบบ Step-by-Step",
      en: "Practice sequencing logic, planning, and understanding step-by-step instructions."
    },
    images: {
      banner1: "/assets/games/game-1/banner1.jpg",
      banner2: "/assets/games/game-1/banner2.jpg",
      banner3: "/assets/games/game-1/banner3.jpg"
    },
    category: "Logic"
  },
  {
    order: 2,
    title: { th: "การนับและจำแนกรูปทรง", en: "Counting & Classification" },
    desc: {
      th: "เสริมทักษะคณิตศาสตร์ ฝึกการสังเกต แยกแยะลักษณะ และจำแนกประเภทของรูปทรง",
      en: "Enhance math skills, observation, differentiation, and shape classification."
    },
    images: {
      banner1: "/assets/games/game-2/banner1.jpg",
      banner2: "/assets/games/game-2/banner2.jpg",
      banner3: "/assets/games/game-2/banner3.jpg"
    },
    category: "Math"
  },
  {
    order: 3,
    title: { th: "เกมจับคู่เงื่อนไข", en: "Conditional Matching" },
    desc: {
      th: "เรียนรู้หลักการของ 'เงื่อนไข' (If-Then) คิดเชื่อมโยงหาเหตุและผล",
      en: "Learn conditional statements (If-Then) and logical reasoning."
    },
    images: {
      banner1: "/assets/games/game-3/banner1.jpg",
      banner2: "/assets/games/game-3/banner2.jpg",
      banner3: "/assets/games/game-3/banner3.jpg"
    },
    category: "Logic"
  },
  {
    order: 4,
    title: { th: "เกมเรียงลำดับวงจรชีวิต", en: "Lifecycle Sequencing" },
    desc: {
      th: "เข้าใจหลักการจัดลำดับข้อมูล คิดเป็นขั้นตอน และเรียนรู้วงจรชีวิตสิ่งมีชีวิต",
      en: "Understand data sequencing, step-by-step thinking, and life cycles."
    },
    images: {
      banner1: "/assets/games/game-4/banner1.jpg",
      banner2: "/assets/games/game-4/banner2.jpg",
      banner3: "/assets/games/game-4/banner3.jpg"
    },
    category: "Science"
  },
  {
    order: 5,
    title: { th: "เกมนับระยะทาง", en: "Step Counting" },
    desc: {
      th: "เข้าใจแนวคิดการวนซ้ำ (Loops) ฝึกวางแผนคาดการณ์และคำนวณระยะทาง",
      en: "Understand loops concepts, planning prediction, and distance calculation."
    },
    images: {
      banner1: "/assets/games/game-5/banner1.jpg",
      banner2: "/assets/games/game-5/banner2.jpg",
      banner3: "/assets/games/game-5/banner3.jpg"
    },
    category: "Coding"
  },
  {
    order: 6,
    title: { th: "จับคู่ผลไม้ในตาราง", en: "Fruit Grid Matching" },
    desc: {
      th: "ฝึกตรรกะ พิกัดตาราง (Coordinates) ความแม่นยำ และการเชื่อมโยงข้อมูล",
      en: "Practice logic, grid coordinates, accuracy, and data association."
    },
    images: {
      banner1: "/assets/games/game-6/banner1.jpg",
      banner2: "/assets/games/game-6/banner2.jpg",
      banner3: "/assets/games/game-6/banner3.jpg"
    },
    category: "Logic"
  },
  {
    order: 7,
    title: { th: "ระบายสีตาราง", en: "Grid-based Coloring" },
    desc: {
      th: "เสริมคิดเชิงลำดับ ความละเอียด เรียนรู้พิกัดตำแหน่ง และการทำตามแบบอย่าง",
      en: "Enhance sequential thinking, precision, coordinates, and pattern following."
    },
    images: {
      banner1: "/assets/games/game-7/banner1.jpg",
      banner2: "/assets/games/game-7/banner2.jpg",
      banner3: "/assets/games/game-7/banner3.jpg"
    },
    category: "Art & Logic"
  }
]

async function main() {
  console.log('Start seeding...')

  try {
    await prisma.gameProgress.deleteMany();
    await prisma.gameLevel.deleteMany();
    console.log('🗑️  Cleaned up old data');
  } catch (e) {
    console.log('First run, no data to clean.');
  }

  for (const game of gamesData) {
    console.log(`Creating chapter ${game.order}: ${game.title.en}`)

    for (let i = 1; i <= 9; i++) {
      const difficulty = Math.ceil(i / 3);

      await prisma.gameLevel.create({
        data: {
          chapterNo: game.order,
          levelNo: i,
          title: {
            th: `ด่านที่ ${i}`,
            en: `Level ${i}`
          },
          desc: {
            th: `แบบฝึกหัดระดับที่ ${i} ของ${game.title.th}`,
            en: `Exercise level ${i} for ${game.title.en}`
          },
          images: game.images,
          difficulty: difficulty,
          maxStars: 3,
          maxScore: 100
        }
      });
    }
  }

  console.log('Seeding finished.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })