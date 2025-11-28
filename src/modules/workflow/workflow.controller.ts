import { workflowService } from "./workflow.service";
import { Stage, StageStatus } from "@prisma/client";

// ================================
// GET STATUS WORKFLOW USER
// ================================
export const getWorkflowController = async ({ params, set }: any) => {
  const { userId } = params;

  const result = await workflowService.getUserWorkflow(userId);

  return {
    userId,
    workflow: result
  };
};


// ================================
// UPDATE STATUS WORKFLOW
// ================================
export const updateWorkflowController = async ({ params, body, user, set }: any) => {
  const { userId } = params;

  // Body yang diterima:
  // {
  //   "stage": "TES_AKADEMIK",
  //   "status": "PASSED",
  //   "confirm": true
  // }

  if (!body || !body.stage || !body.status) {
    set.status = 400;
    return { error: "MISSING_FIELDS" };
  }

  // Konversi string menjadi enum Prisma
  const stage = body.stage as Stage;
  const status = body.status as StageStatus;
  const confirm = Boolean(body.confirm);

  const result = await workflowService.updateStage(
    userId,
    stage,
    status,
    confirm,
    user.id   // adminId dari JWT
  );

  if (result.error) {
    set.status = 400;
    return result;
  }

  return result;
};
