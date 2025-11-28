import "elysia";

declare module "elysia" {
  interface Context {
    user?: {
      id: string;
      email: string;
      role: "ADMIN" | "USER";
      [key: string]: any;
    };
  }
}
