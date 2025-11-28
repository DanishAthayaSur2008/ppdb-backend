import type { Handler } from "elysia";
import { authService } from "./auth.service";

export const registerController: Handler = async (ctx) => {
  const body = ctx.body as {
    email: string;
    name: string;
    password: string;
  };

  const result = await authService.register(body);

  if ("error" in result) {
    ctx.set.status = 400;
    return { error: result.error };
  }

  return result;
};

export const loginController: Handler = async (ctx) => {
  const body = ctx.body as {
    email: string;
    password: string;
  };

  const result = await authService.login(body);

  if ("error" in result) {
    ctx.set.status = 400;
    return { error: result.error };
  }

  return result;
};
