import { formService } from "./form.service";

// START FORM
export const startFormController = async ({ user }: any) => {
  return await formService.start(user.id);
};

// GET MY FORM
export const getMyFormController = async ({ user }: any) => {
  return await formService.getMyForm(user.id);
};

// AUTOSAVE
export const saveSectionController = async ({ params, body, user }: any) => {
  return await formService.saveSection(
    params.formId,
    Number(params.sectionNumber),
    body,
    user.id
  );
};

// UPLOAD FILE (FormData)
export const uploadDocumentController = async ({ params, body, user }: any) => {
  return await formService.uploadDocument(
    params.formId,
    body,      // form-data body
    user.id
  );
};

// SUBMIT FORM
export const submitFormController = async ({ params, user }: any) => {
  return await formService.submit(params.formId, user.id);
};
