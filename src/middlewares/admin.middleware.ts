export const adminMiddleware = async (ctx: any) => {
  if (!ctx.user) {
    ctx.set.status = 401;
    return { error: "Unauthorized" };
  }

  if (ctx.user.role !== "ADMIN") {
    ctx.set.status = 403;
    return { error: "Forbidden: Admin only" };
  }

  return;
};
