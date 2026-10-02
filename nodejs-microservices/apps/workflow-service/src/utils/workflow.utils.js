export function convertToPublicWorkflow(workflow) {
  return {
    id: workflow.id,
    taskId: workflow.task_id,
    message: workflow.message,
    createdBy: workflow.created_by,
    eventType: workflow.event_type,
    createdAt: workflow.created_at,
  };
}
