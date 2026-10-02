import { getPool } from "shared";

export async function createWorkflow(input) {
  const result = await getPool().query(
    `
        INSERT INTO task_workflows (task_id, event_type, message, created_by)
        VALUES ($1, $2, $3, $4)
        RETURNING id, task_id, event_type, message, created_by, created_at
        
        `,
    [input.taskId, input.eventType, input.message, input.createdBy],
  );

  return result.rows[0];
}

export async function listWorkflowsByTaskId(taskId) {
  const result = await getPool().query(
    `
    SELECT id, task_id, event_type, message, created_by, created_at
    FROM task_workflows
    WHERE task_id = $1
    ORDER BY created_at DESC
    
    `,
    [taskId],
  );

  return result.rows;
}

export async function findTaskOwner(taskId) {
  const result = await getPool().query(
    `
    SELECT created_by FROM tasks WHERE id = $1
    `,
    [taskId],
  );

  return result.rows[0] ?? null;
}
