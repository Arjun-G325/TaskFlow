import React from "react";

import ProjectMembers from "./ProjectMembers";

const STATUS_LABELS = { todo: "To do", in_progress: "In progress", done: "Done" };

export default function ProjectEditor({
  editing,
  name,
  description,
  onNameChange,
  onDescriptionChange,
  onSubmit,
  onCancel,
  busy,
  project,
  currentUserId,
  tasks,
  onCreateTask,
  onEditTask,
  onDeleteTask,
  members,
  memberEmail,
  onMemberEmailChange,
  onAddMember,
  onRemoveMember,
  memberBusy,
}) {
  return (
    <section className="project-form-card project-management-card">
      <form onSubmit={onSubmit}>
        <h2>{editing ? "Edit project" : "Create a project"}</h2>
        <label htmlFor="project-name">Project name</label>
        <input id="project-name" value={name} onChange={(event) => onNameChange(event.target.value)} maxLength={150} required autoFocus />
        <label htmlFor="project-description">Description <span>(optional)</span></label>
        <textarea id="project-description" value={description} onChange={(event) => onDescriptionChange(event.target.value)} rows={3} />
        <div className="project-form-actions">
          <button className="secondary-button" type="button" onClick={onCancel}>Cancel</button>
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? "Saving..." : editing ? "Save project details" : "Create project"}
          </button>
        </div>
      </form>

      {editing && project && (
        <div className="project-management-sections">
          <section className="management-section">
            <div className="management-section-heading">
              <div><div className="eyebrow">WORK ITEMS</div><h3>Manage tasks <span>({tasks.length})</span></h3></div>
              <button className="primary-button" type="button" onClick={onCreateTask}>+ Add task</button>
            </div>
            {tasks.length ? (
              <ul className="management-task-list">
                {tasks.map((task) => (
                  <li key={task.id}>
                    <span><strong>{task.title}</strong><small>{STATUS_LABELS[task.status] || task.status} · {task.priority} priority</small></span>
                    <button type="button" className="secondary-button" onClick={() => onEditTask(task)}>Edit</button>
                    <button type="button" className="danger-button" onClick={() => onDeleteTask(task)}>Delete</button>
                  </li>
                ))}
              </ul>
            ) : <p className="management-empty">No tasks yet. Add one to start planning the work.</p>}
          </section>

          <ProjectMembers
            members={members}
            isOwner={project.owner_id === currentUserId}
            email={memberEmail}
            onEmailChange={onMemberEmailChange}
            onAdd={onAddMember}
            busy={memberBusy}
            onRemove={onRemoveMember}
            allowRemoval
            formId="manage-member-email"
          />
        </div>
      )}
    </section>
  );
}
