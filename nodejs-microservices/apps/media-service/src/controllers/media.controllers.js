import { AppError, successResponse } from "shared";
import * as attachmentService from "../services/media.services.js";

function requireIdentity(req) {
  const userId = req.header("x-user-id");
  const role = req.header("x-user-role");

  if (!role || !userId) {
    throw new AppError(401, "Missing user identity");
  }

  return { userId, role };
}

export async function uploadAttachment(req, res, next) {
  try {
    const { userId, role } = requireIdentity(req);
    const taskId = String(req.params.taskId);
    const attachment = await attachmentService.uploadAttachment({
      taskId,
      userId,
      role,
      file: req.file,
    });

    successResponse(res, { attachment }, 201);
  } catch (err) {
    next(err);
  }
}

export async function listAttachments(req, res, next) {
  try {
    const { userId, role } = requireIdentity(req);
    const taskId = String(req.params.taskId);
    const extractAttachments = await attachmentService.listAttachments(
      taskId,
      userId,
      role,
    );
    successResponse(res, { extractAttachments });
  } catch (err) {
    next(err);
  }
}
