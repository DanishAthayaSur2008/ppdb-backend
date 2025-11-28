import { Elysia } from "elysia";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { adminMiddleware } from "../../middlewares/admin.middleware";

import {
  sendAdminNotificationController,
  myNotificationsController,
  markReadController,
  adminListUserNotificationsController,
} from "./notification.controller";

export const notificationRoutes = new Elysia().group("/notification", app =>
  app
    .onBeforeHandle(authMiddleware)

    // user
    .get("/my", myNotificationsController)
    .patch("/:notifId/read", markReadController)

    // admin sub-group
    .group("/admin", admin =>
      admin
        .onBeforeHandle(adminMiddleware)
        .post("/send", sendAdminNotificationController)
        .get("/user/:userId/notifications", adminListUserNotificationsController)
    )
);
