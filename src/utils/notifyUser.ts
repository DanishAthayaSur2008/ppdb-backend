import { PrismaClient, NotificationType } from "@prisma/client";
const prisma = new PrismaClient();

export async function sendNotification(userId: number, title: string, message: string, type: NotificationType = NotificationType.ADMIN_NOTE) {
  try {
    await prisma.notification.create({
      data: { userId, title, message, type },
    });
  } catch (err) {
    console.warn("⚠️ Failed to send notification:", (err as any).message);
  }
}
