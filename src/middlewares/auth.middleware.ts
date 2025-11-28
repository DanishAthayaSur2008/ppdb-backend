import { verifyToken } from "../utils/jwt";

export const authMiddleware = async (ctx: any) => {
  const auth = ctx.request.headers.get("authorization");

  if (!auth) {
    ctx.set.status = 401; // <-- tidak pakai optional chaining
    return { error: "Unauthorized" };
  }

  const token = auth.replace("Bearer ", "");

  try {
    const { payload } = await verifyToken(token);
    ctx.user = payload; // simpan user login
  } catch (err) {
    ctx.set.status = 401;
    return { error: "Invalid or expired token" };
  }
};
