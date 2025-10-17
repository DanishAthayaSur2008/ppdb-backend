"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// prisma/seed.ts
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const prisma = new client_1.PrismaClient();
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
        const hashed = await bcryptjs_1.default.hash(admin.password, 10);
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
