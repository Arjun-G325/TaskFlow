import React from "react";

export default function TaskForm({
  editing,
  title,
  description,
  priority,
  status,
  dueAt,
  assigneeIds,
  members,
  busy,
  onTitleChange,
  onDescriptionChange,
  onPriorityChange,
  onStatusChange,
  onDueAtChange,
  onAssigneeIdsChange,
  onSubmit,
  onCancel,
}) {
  return (
    <form className="project-form-card" onSubmit={onSubmit}>
      <h2>{editing ? "Edit task" : "Add a task"}</h2>
      <label htmlFor="task-title">Task title</label>
      <input id="task-title" value={title} onChange={(event) => onTitleChange(event.target.value)} maxLength={200} required autoFocus />
      <label htmlFor="task-description">Description <span>(optional)</span></label>
      <textarea id="task-description" value={description} onChange={(event) => onDescriptionChange(event.target.value)} rows={3} />
      <div className="task-form-row">
        <div>
          <label htmlFor="task-priority">Priority</label>
          <select id="task-priority" value={priority} onChange={(event) => onPriorityChange(event.target.value)}>
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
          </select>
        </div>
        <div>
          <label htmlFor="task-due">Due date <span>(optional)</span></label>
          <input id="task-due" type="datetime-local" value={dueAt} onChange={(event) => onDueAtChange(event.target.value)} />
        </div>
      </div>
      <label htmlFor="task-status">Status</label>
      <select id="task-status" value={status} onChange={(event) => onStatusChange(event.target.value)}>
        <option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option>
      </select>
      <label htmlFor="task-assignees">Assignees <span>(optional; Ctrl-click to select multiple)</span></label>
      <select
        id="task-assignees"
        multiple
        size={Math.min(4, Math.max(members.length, 2))}
        value={assigneeIds}
        onChange={(event) => onAssigneeIdsChange(Array.from(event.target.selectedOptions, (option) => option.value))}
      >
        {members.map((member) => <option key={member.user_id} value={member.user_id}>{member.username} ({member.role})</option>)}
      </select>
      <div className="project-form-actions">
        <button className="secondary-button" type="button" onClick={onCancel}>Cancel</button>
        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? "Saving..." : editing ? "Save task" : "Add task"}
        </button>
      </div>
    </form>
  );
}
