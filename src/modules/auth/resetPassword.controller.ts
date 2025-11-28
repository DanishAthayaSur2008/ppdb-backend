// src/modules/auth/resetPassword.controller.ts
import { resetPasswordService } from "./resetPassword.service";

export const requestResetController = async ({ body }: any) => {
  return await resetPasswordService.requestReset(
    body.email,
    process.env.DEV_FRONTEND_URL!
  );
};

export const verifyResetController = async ({ query }: any) => {
  const valid = await resetPasswordService.verifyToken(query.token);
  return { valid };
};

export const resetPasswordController = async ({ body }: any) => {
  if (!body.token || !body.newPassword)
    return { error: "Token dan password wajib diisi." };

  if (body.newPassword.length < 6)
    return { error: "Password minimal 6 karakter." };

  const ok = await resetPasswordService.resetPassword(
    body.token,
    body.newPassword
  );

  if (!ok)
    return { error: "Token tidak valid atau sudah kadaluarsa." };

  return { message: "Password berhasil direset." };
};

// =========================
// DEBUG for Postman
// =========================
export const debugTokenController = async ({ body }: any) => {
  const data = await resetPasswordService.debugToken(body.email);
  return data;
};
