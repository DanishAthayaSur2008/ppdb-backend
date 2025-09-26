// prisma/seed.ts
import prisma from "../prisma/client"; // gunakan client yang sama
import bcrypt from "bcryptjs";

const ADMIN_LIST = [
  { email: process.env.ADMIN1_EMAIL ?? "admin1@mail.com", password: process.env.ADMIN1_PW ?? "123456" },
  { email: process.env.ADMIN2_EMAIL ?? "admin2@mail.com", password: process.env.ADMIN2_PW ?? "123456" },
  { email: process.env.ADMIN3_EMAIL ?? "admin3@mail.com", password: process.env.ADMIN3_PW ?? "123456" },
  { email: process.env.ADMIN4_EMAIL ?? "admin4@mail.com", password: process.env.ADMIN4_PW ?? "123456" },
  { email: process.env.ADMIN5_EMAIL ?? "admin5@mail.com", password: process.env.ADMIN5_PW ?? "123456" },
];

async function main() {
  for (const admin of ADMIN_LIST) {
    const hashed = await bcrypt.hash(admin.password, 10);
    await prisma.user.upsert({
      where: { email: admin.email },
      update: {},
      create: {
        email: admin.email,
        password: hashed,
        // kalau TS complain tentang enum, pakai casting:
        role: "ADMIN" as any,
      },
    });
    console.log(`seeded admin: ${admin.email}`);
  }
  console.log("✅ Admin accounts created!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
