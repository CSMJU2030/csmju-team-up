import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DIRECT_URL or DATABASE_URL is required");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  // Seed only creates a local development account/profile surrogate identified
  // by core_user_id. Production identity remains owned by Core Hub.
  const coreUserId = "seed-student-001";
  await prisma.collaborationProfile.upsert({
    where: { coreUserId },
    update: { skills: ["React", "Node.js", "Python"], isAvailable: true },
    create: {
      coreUserId,
      skills: ["React", "Node.js", "Python"],
      isAvailable: true,
      contactText: "ใช้สำหรับ local development เท่านั้น",
    },
  });

  console.log(`Seeded collaboration profile for ${coreUserId}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
