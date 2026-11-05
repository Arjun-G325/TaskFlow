import React from "react";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";

const COLUMNS = [
  { key: "todo", title: "To do", tone: "slate" },
  { key: "in_progress", title: "In progress", tone: "blue" },
  { key: "done", title: "Done", tone: "green" },
];

export default function TaskBoard({ tasks, members, onAddTask, onEditTask, onDeleteTask, onStatusChange }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragEnd({ active, over }) {
    if (!over) return;
    const task = tasks.find((item) => item.id === Number(active.id));
    if (task && COLUMNS.some((column) => column.key === over.id) && task.status !== over.id) {
      onStatusChange(task, over.id);
    }
  }

  return (
    <>
      <p className="board-help">Drag a task by its handle into To do, In progress, or Done. Its status is saved when you drop it.</p>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="task-board project-task-board">
          {COLUMNS.map((column) => (
            <DroppableTaskColumn
              key={column.key}
              column={column}
              tasks={tasks.filter((task) => task.status === column.key)}
              members={members}
              onAddTask={onAddTask}
              onEditTask={onEditTask}
              onDeleteTask={onDeleteTask}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      </DndContext>
    </>
  );
}

function DroppableTaskColumn({ column, tasks, members, onAddTask, onEditTask, onDeleteTask, onStatusChange }) {
  const { isOver, setNodeRef } = useDroppable({ id: column.key });
  return (
    <section ref={setNodeRef} className={`task-column${isOver ? " drop-target" : ""}`}>
      <div className="task-column-heading">
        <div><span className={`status-dot ${column.tone}`} /><h2>{column.title}</h2><span className="count">{tasks.length}</span></div>
      </div>
      {tasks.length ? tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          members={members}
          onEdit={onEditTask}
          onDelete={onDeleteTask}
          onStatusChange={onStatusChange}
        />
      )) : <div className="empty-column"><span>No tasks</span></div>}
      <button className="add-task" type="button" onClick={onAddTask}>+ Add task</button>
    </section>
  );
}

function TaskCard({ task, members, onEdit, onDelete, onStatusChange }) {
  const { attributes, isDragging, listeners, setNodeRef, transform } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <article ref={setNodeRef} style={style} className={`task-card${isDragging ? " dragging" : ""}`}>
      <div className="task-card-top">
        <div className="task-card-tools">
          <button className="drag-handle" type="button" aria-label={`Drag ${task.title}`} {...listeners} {...attributes}>⠿</button>
          <span className={`priority-tag ${task.priority}`}>{task.priority}</span>
        </div>
        <div>
          <button type="button" aria-label={`Edit ${task.title}`} onClick={() => onEdit(task)}>Edit</button>
          <button type="button" aria-label={`Delete ${task.title}`} onClick={() => onDelete(task)}>×</button>
        </div>
      </div>
      <h3>{task.title}</h3>
      {task.description && <p>{task.description}</p>}
      <div className="task-assignees">
        Created by {members.find((member) => member.user_id === task.created_by_id)?.username || `User ${task.created_by_id}`}
      </div>
      {task.assignee_ids?.length > 0 && (
        <div className="task-assignees">
          {task.assignee_ids.map((id) => members.find((member) => member.user_id === id)?.username || `User ${id}`).join(", ")}
        </div>
      )}
      {task.due_at && <small>Due {new Date(task.due_at).toLocaleString()}</small>}
      <label className="task-status-label" htmlFor={`task-status-${task.id}`}>Move to</label>
      <select id={`task-status-${task.id}`} value={task.status} onChange={(event) => onStatusChange(task, event.target.value)}>
        <option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option>
      </select>
    </article>
  );
}
