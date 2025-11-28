import { Elysia } from "elysia";
import { app } from "./app";
import "dotenv/config";  

const server = new Elysia()
  .use(app)
  .onError(({ code, error, set }) => {
    const err: any = error;

    console.error("🔥 GLOBAL ERROR:", err?.message || err);

    set.status = 500;
    return { error: err?.message || "Internal Server Error" };
  });

server.listen(3000);
console.log("🚀 SPMB Backend Running at http://localhost:3000");
