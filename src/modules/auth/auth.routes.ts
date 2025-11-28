import { Elysia, t } from "elysia";
import { registerController, loginController } from "./auth.controller";
import { 
  requestResetController,
  verifyResetController,
  resetPasswordController,
  debugTokenController
} from "./resetPassword.controller";

export const authRoutes = new Elysia().group("/auth", (app) =>
  app
    .post("/register", registerController, {
      body: t.Object({
        email: t.String(),
        name: t.String(),
        password: t.String()
      })
    })

    .post("/login", loginController, {
      body: t.Object({
        email: t.String(),
        password: t.String()
      })
    })

    // ============================
    // RESET PASSWORD
    // ============================

    .post("/reset/request", requestResetController, {
      body: t.Object({
        email: t.String()
      })
    })

    .get("/reset/verify", verifyResetController, {
      query: t.Object({
        token: t.String()
      })
    })

    .post("/reset/submit", resetPasswordController, {
      body: t.Object({
        token: t.String(),
        newPassword: t.String()
      })
    })

    .post("/reset/debug", debugTokenController, {
      body: t.Object({
        email: t.String()
      })
    })
);
