import { prisma } from "../../database/prisma";
import { NotificationType } from "@prisma/client";

export const notificationService = {
  // ======================================
  // D1 - Admin kirim notifikasi manual
  // ======================================
  async sendAdminNotification(adminId: string, userId: string, message: string) {
    return prisma.notification.create({
      data: {
        userId,
        message,
        type: NotificationType.INFO
      }
    });
  },

  // ======================================
  // D3 - User mengambil semua notifikasi
  // ======================================
  async getMyNotifications(userId: string) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });
  },

  // ======================================
  // D4 - Tandai sebagai read
  // ======================================
  async markAsRead(notifId: string, userId: string) {
    const notif = await prisma.notification.findFirst({
      where: { id: notifId, userId }
    });

    if (!notif) return { error: "NOT_FOUND" };

    return prisma.notification.update({
      where: { id: notifId },
      data: { isRead: true }
    });
  },

  // ======================================
  // D5 - Admin lihat notifikasi user
  // ======================================
  async getUserNotifications(userId: string) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });
  }
};
