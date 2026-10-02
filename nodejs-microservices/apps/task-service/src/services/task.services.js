import * as taskRepo from "../repositories/task.repository.js";
import { convertToPublicTask } from "../utils/task.utils.js";
import { AppError } from "shared";
import { publishTaskEvent } from "../kafka.js";

export async function createTask(input, userId) {
  const newlyCreatedTask = await taskRepo.createTask({
    title: input.title,
    createdBy: userId,
  });

  // publish one event here saying ok now we just created one task
  await publishTaskEvent(newlyCreatedTask.id, userId);

  return convertToPublicTask(newlyCreatedTask);
}

export async function listTasks(userId, role) {
  if (!userId || !role) {
    throw new AppError(401, "Missing user identity");
  }

  const tasks = await taskRepo.listTasks({ userId, role });

  return tasks.map(convertToPublicTask);
}

export async function getSingleTask(id, userId, role) {
  const task = await taskRepo.findSingleTaskById(id);

  if (!task) {
    throw new AppError(404, "Task not found");
  }

  if (role !== "ADMIN" && task.created_by !== userId) {
    throw new AppError(403, "forbidden");
  }

  return convertToPublicTask(task);
}

export async function deleteSingleTask(id, role) {
  if (role !== "ADMIN") {
    throw new AppError(403, "Forbidden");
  }

  const task = await taskRepo.findSingleTaskById(id);

  if (!task) {
    throw new AppError(404, "Task not found");
  }

  await taskRepo.deleteSingleTaskById(id);

  return { id };
}
