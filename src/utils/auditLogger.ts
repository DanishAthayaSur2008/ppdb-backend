import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function logAudit(req: any, userId: number | null, action: string, details?: string) {
  try {
    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
    await prisma.auditLog.create({
      data: { userId, registrationId: req.params?.id ? Number(req.params.id) : null, action, details, ip },
    });
  } catch (err) {
    console.warn("⚠️ Failed to log audit:", (err as any).message);
  }
}
