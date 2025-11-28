import { adminService } from "./admin.service";

export const listPendingController = async () => {
  return await adminService.listByStatus("PENDING");
};

export const listRejectedController = async () => {
  return await adminService.listByStatus("REJECTED");
};

export const listAcceptedController = async () => {
  return await adminService.listByStatus("ACCEPTED");
};

export const getFormDetailController = async ({ params, set }: any) => {
  const { formId } = params;
  const res = await adminService.getFormDetail(formId);

  if ("error" in res) {
    set.status = 404;
    return res;
  }

  return res;
};

export const approveFormController = async ({ params, user, set }: any) => {
  const { formId } = params;

  const res = await adminService.approveForm(formId, user.id);

  if ("error" in res) {
    set.status = 400;
    return res;
  }

  return res;
};

export const rejectFormController = async ({ params, body, user, set }: any) => {
  const { formId } = params;
  const { note } = body ?? {};

  if (!note) {
    set.status = 400;
    return { error: "note is required" };
  }

  const res = await adminService.rejectForm(formId, user.id, note);

  if ("error" in res) {
    set.status = 400;
    return res;
  }

  return res;
};
