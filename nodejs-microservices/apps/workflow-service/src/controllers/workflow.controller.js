import { AppError, successResponse } from "shared";
import * as workflowService from "../services/workflow.services.js";

function requireIdentity(req) {
  const userId = req.header("x-user-id");
  const role = req.header("x-user-role");

  if (!role || !userId) {
    throw new AppError(401, "Missing user identity");
  }

  return { userId, role };
}

export async function listWorkflowsByTask(req, res, next) {
  try {
    const { userId, role } = requireIdentity(req);
    const taskId = String(req.params.taskId);
    const workflows = await workflowService.listWorkflowsByTask(
      taskId,
      userId,
      role,
    );
    successResponse(res, { workflows });
  } catch (err) {
    next(err);
  }
}
