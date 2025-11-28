import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { staticPlugin } from "@elysiajs/static";
import { cors } from "@elysiajs/cors";     // ← DITAMBAHKAN
import "dotenv/config";

import { authRoutes } from "./modules/auth/auth.routes";
import { adminRoutes } from "./modules/admin/admin.routes";
import { formRoutes } from "./modules/form/form.routes";
import { notificationRoutes } from "./modules/notification/notification.routes";

export const app = new Elysia()

  // CORS FIX — WAJIB UNTUK NEXT.JS
  .use(
    cors({
      origin: "*", // atau ganti jadi "http://localhost:3000"
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  )

  .use(swagger())
  .use(
    staticPlugin({
      assets: "./uploads",
      prefix: "/uploads",
    })
  )

  // ROUTES
  .use(authRoutes)
  .use(formRoutes)
  .use(adminRoutes)
  .use(notificationRoutes)

  // GLOBAL ERROR HANDLER
  .onError(({ error, code, set }) => {
    console.error("🔥 GLOBAL ERROR:", code, error);
    set.status = 500;
    return { error: (error as Error).message ?? String(error) };
  })

  .get("/", () => ({ message: "SPMB Backend Running" }));
