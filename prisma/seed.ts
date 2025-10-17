// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();
const prisma = new PrismaClient();

const ADMIN_LIST = [
  { email: process.env.ADMIN1_EMAIL ?? "admin1@mail.com", password: process.env.ADMIN1_PW ?? "tuturu123456" },
  { email: process.env.ADMIN2_EMAIL ?? "admin2@mail.com", password: process.env.ADMIN2_PW ?? "bazma123456" },
  { email: process.env.ADMIN3_EMAIL ?? "admin3@mail.com", password: process.env.ADMIN3_PW ?? "kiw123456" },
  { email: process.env.ADMIN4_EMAIL ?? "admin4@mail.com", password: process.env.ADMIN4_PW ?? "123456" },
  { email: process.env.ADMIN5_EMAIL ?? "admin5@mail.com", password: process.env.ADMIN5_PW ?? "123456" },
];

async function main() {
  console.log("🚀 Seeding admin accounts...");

  for (const admin of ADMIN_LIST) {
    const hashed = await bcrypt.hash(admin.password, 10);
    await prisma.user.upsert({
      where: { email: admin.email },
      update: {},
      create: {
        email: admin.email,
        password: hashed,
        role: "ADMIN",
      },
    });
    console.log(`✅ Seeded admin: ${admin.email}`);
  }

  console.log("🎉 Admin seeding completed!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
