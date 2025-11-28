import { notificationService } from "./notification.service";

export const sendAdminNotificationController = async ({ body, user, set }: any) => {
  const { userId, message } = body;

  if (!userId || !message) {
    set.status = 400;
    return { error: "userId and message are required" };
  }

  const result = await notificationService.sendAdminNotification(user.id, userId, message);
  return { message: "Notification sent", result };
};

export const myNotificationsController = async ({ user }: any) => {
  return notificationService.getMyNotifications(user.id);
};

export const markReadController = async ({ params, user, set }: any) => {
  const { notifId } = params;
  const result = await notificationService.markAsRead(notifId, user.id);

 if ("error" in result) {
  set.status = 404;
  return result;
}

  return { message: "Marked as read" };
};

export const adminListUserNotificationsController = async ({ params }: any) => {
  const { userId } = params;
  return notificationService.getUserNotifications(userId);
};
