import { Elysia } from "elysia";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { adminMiddleware } from "../../middlewares/admin.middleware";

import {
  listPendingController,
  listRejectedController,
  listAcceptedController,
  getFormDetailController,
  approveFormController,
  rejectFormController,
} from "./admin.controller";

import {
  getWorkflowController,
  updateWorkflowController,
} from "../workflow/workflow.controller";

import { adminDashboardController } from "./dashboard.controller";
import { provinceStatsController } from "../dashboard/dashboard.controller";

export const adminRoutes = new Elysia().group("/admin", app =>
  app
    .onBeforeHandle(authMiddleware)
    .onBeforeHandle(adminMiddleware)

    .get("/dashboard", adminDashboardController)
    .get("/dashboard/province-stats", provinceStatsController)

    // forms by status
    .get("/forms/pending", listPendingController)
    .get("/forms/rejected", listRejectedController)
    .get("/forms/accepted", listAcceptedController)

    // form detail
    .get("/form/:formId", getFormDetailController)

    // form actions
    .post("/form/:formId/approve", approveFormController)
    .post("/form/:formId/reject", rejectFormController)

    // workflow
    .get("/workflow/:userId", getWorkflowController)
    .post("/workflow/:userId/update", updateWorkflowController)
);
