import { getPool } from "shared";

export async function findTaskAccess(taskId) {
  const result = await getPool().query(
    `
    SELECT id, created_by FROM tasks WHERE id = $1
    `,
    [taskId],
  );

  return result.rows[0] ?? null;
}

export async function createAttachment(input) {
  const result = await getPool().query(
    `
     INSERT INTO attachments (task_id, image_url, public_id, uploaded_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id, task_id, image_url, public_id, uploaded_by, created_at
     `,
    [input.taskId, input.imageUrl, input.publicId, input.uploadedBy],
  );

  return result.rows[0];
}

export async function listByTaskId(taskId) {
  const result = await getPool().query(
    `
        SELECT id, task_id, image_url, public_id, uploaded_by, created_at
        FROM attachments
        WHERE task_id = $1
        ORDER BY created_at DESC
        
        `,
    [taskId],
  );

  return result.rows;
}
