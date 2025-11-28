import { Elysia, t } from "elysia";
import { authMiddleware } from "../../middlewares/auth.middleware";

import {
  startFormController,
  getMyFormController,
  saveSectionController,
  uploadDocumentController,
  submitFormController,
} from "./form.controller";

export const formRoutes = new Elysia().group("/form", app =>
  app
    .onBeforeHandle(authMiddleware)
    .post("/start", startFormController)
    .get("/my", getMyFormController)

    .put("/:formId/section/:sectionNumber", saveSectionController)

    .post(
      "/:formId/upload",
      uploadDocumentController,
      {
        body: t.Object({
          file: t.File()     // FIX DI SINI
        })
      }
    )

    .post("/:formId/submit", submitFormController)
);
