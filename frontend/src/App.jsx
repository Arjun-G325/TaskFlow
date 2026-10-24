import React, { useEffect, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { DndContext, PointerSensor, useDroppable, useDraggable, useSensor, useSensors } from "@dnd-kit/core";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const taskColumnsLabel = (status) => ({ todo: "To do", in_progress: "In progress", done: "Done" }[status] || status);

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body.detail ?? body.message;
    const message = typeof detail === "string"
      ? detail
      : Array.isArray(detail)
        ? detail.map((item) => item?.msg || item?.message || JSON.stringify(item)).join("; ")
        : detail && typeof detail === "object"
          ? detail.message || detail.detail || JSON.stringify(detail)
          : "The request could not be completed.";
    throw new Error(message);
  }
  return body;
}

export default function App() {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [page, setPage] = useState("login");
  const [signupStep, setSignupStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [signupToken, setSignupToken] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [projectDetails, setProjectDetails] = useState(null);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");
  const [projectNotice, setProjectNotice] = useState("");
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectBusy, setProjectBusy] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskStatus, setTaskStatus] = useState("todo");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [taskAssigneeIds, setTaskAssigneeIds] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberBusy, setMemberBusy] = useState(false);

  async function loadCurrentUser(token) {
    const account = await request("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    setUser(account);
  }

  async function loadProjects(token) {
    setProjectsLoading(true);
    setProjectsError("");
    try {
      const result = await request("/projects", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProjects(result);
    } catch (err) {
      setProjectsError(err.message);
    } finally {
      setProjectsLoading(false);
    }
  }

  async function loadTasks(projectId, token = localStorage.getItem("taskflow_access_token")) {
    if (!projectId || !token) return;
    setTasksLoading(true);
    setProjectsError("");
    try {
      const result = await request(`/projects/${projectId}/tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTasks(result);
    } catch (err) {
      setProjectsError(err.message);
    } finally {
      setTasksLoading(false);
    }
  }

  async function loadProject(projectId, token = localStorage.getItem("taskflow_access_token")) {
    if (!projectId || !token) return;
    try {
      const result = await request(`/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProjectDetails(result);
    } catch (err) {
      setProjectsError(err.message);
    }
  }

  async function loadProjectMembers(projectId, token = localStorage.getItem("taskflow_access_token")) {
    if (!projectId || !token) return;
    try {
      const result = await request(`/projects/${projectId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProjectMembers(result);
    } catch (err) {
      setProjectsError(err.message);
    }
  }

  useEffect(() => {
    const savedToken = localStorage.getItem("taskflow_access_token");
    if (!savedToken) return;

    loadCurrentUser(savedToken).then(() => loadProjects(savedToken)).catch(() => {
      localStorage.removeItem("taskflow_access_token");
    });
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setTasks([]);
      setProjectDetails(null);
      setProjectMembers([]);
      return;
    }
    setProjectDetails(null);
    loadProject(selectedProjectId);
    loadTasks(selectedProjectId);
    loadProjectMembers(selectedProjectId);
  }, [selectedProjectId]);

  function clearNotices() {
    setError("");
    setMessage("");
  }

  async function handleSendCode(event) {
    event.preventDefault();
    clearNotices();
    setBusy(true);
    try {
      const result = await request("/auth/email-code", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMessage(result.message);
      setSignupStep("code");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyCode(event) {
    event.preventDefault();
    clearNotices();
    setBusy(true);
    try {
      const result = await request("/auth/email-code/verify", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      setSignupToken(result.signup_token);
      setSignupStep("credentials");
      setMessage("Email verified. Choose a username and password.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSignup(googleResponse) {
    clearNotices();
    if (!googleResponse.credential) {
      setError("Google did not return a verification credential. Please try again.");
      return;
    }

    setBusy(true);
    try {
      const result = await request("/auth/google", {
        method: "POST",
        body: JSON.stringify({ credential: googleResponse.credential }),
      });
      setEmail(result.email);
      setSignupToken(result.signup_token);
      setSignupStep("credentials");
      setMessage("Google verified your email. Choose a username and password.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    clearNotices();
    setBusy(true);
    try {
      await request("/auth/register", {
        method: "POST",
        body: JSON.stringify({ signup_token: signupToken, username, password }),
      });
      setPage("login");
      setSignupStep("email");
      setPassword("");
      setCode("");
      setMessage("Account created. Log in with your new username and password.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    clearNotices();
    setBusy(true);
    try {
      const result = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      localStorage.setItem("taskflow_access_token", result.access_token);
      await loadCurrentUser(result.access_token);
      await loadProjects(result.access_token);
      setPassword("");
    } catch (err) {
      localStorage.removeItem("taskflow_access_token");
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("taskflow_access_token");
    setUser(null);
    setUsername("");
    setPassword("");
    setProjects([]);
    setTasks([]);
    setProjectMembers([]);
    setSelectedProjectId(null);
    setProjectDetails(null);
    setProjectsError("");
    setProjectNotice("");
    setMessage("You have been logged out.");
  }

  function openCreateProject() {
    setEditingProjectId(null);
    setProjectName("");
    setProjectDescription("");
    setProjectFormOpen(true);
    setProjectNotice("");
  }

  function openEditProject(project) {
    setEditingProjectId(project.id);
    setProjectName(project.name);
    setProjectDescription(project.description || "");
    setProjectFormOpen(true);
    setProjectNotice("");
  }

  async function handleSaveProject(event) {
    event.preventDefault();
    const token = localStorage.getItem("taskflow_access_token");
    if (!token) return;
    setProjectBusy(true);
    setProjectsError("");
    setProjectNotice("");
    const isEditing = editingProjectId !== null;
    try {
      const project = await request(isEditing ? `/projects/${editingProjectId}` : "/projects", {
        method: isEditing ? "PUT" : "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: projectName, description: projectDescription.trim() || null }),
      });
      await loadProjects(token);
      setProjectDetails(project);
      setSelectedProjectId(project.id);
      setProjectFormOpen(false);
      setProjectNotice(isEditing ? "Project updated." : "Project created.");
    } catch (err) {
      setProjectsError(err.message);
    } finally {
      setProjectBusy(false);
    }
  }

  async function handleDeleteProject(project) {
    if (!window.confirm(`Delete “${project.name}”? This also deletes its project data.`)) return;
    const token = localStorage.getItem("taskflow_access_token");
    if (!token) return;
    setProjectBusy(true);
    setProjectsError("");
    setProjectNotice("");
    try {
      await request(`/projects/${project.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedProjectId(null);
      setProjectDetails(null);
      await loadProjects(token);
      setProjectNotice("Project deleted.");
    } catch (err) {
      setProjectsError(err.message);
    } finally {
      setProjectBusy(false);
    }
  }

  function openCreateTask() {
    setEditingTaskId(null);
    setTaskTitle("");
    setTaskDescription("");
    setTaskPriority("medium");
    setTaskStatus("todo");
    setTaskDueAt("");
    setTaskAssigneeIds([]);
    setTaskFormOpen(true);
    setProjectNotice("");
  }

  function openEditTask(task) {
    setEditingTaskId(task.id);
    setTaskTitle(task.title);
    setTaskDescription(task.description || "");
    setTaskPriority(task.priority);
    setTaskStatus(task.status);
    setTaskDueAt(task.due_at ? new Date(task.due_at).toISOString().slice(0, 16) : "");
    setTaskAssigneeIds((task.assignee_ids || []).map(String));
    setTaskFormOpen(true);
    setProjectNotice("");
  }

  async function handleSaveTask(event) {
    event.preventDefault();
    const token = localStorage.getItem("taskflow_access_token");
    if (!token || !selectedProjectId) return;
    setProjectBusy(true);
    setProjectsError("");
    const isEditing = editingTaskId !== null;
    try {
      await request(isEditing ? `/projects/${selectedProjectId}/tasks/${editingTaskId}` : `/projects/${selectedProjectId}/tasks`, {
        method: isEditing ? "PUT" : "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: taskTitle,
          description: taskDescription.trim() || null,
          priority: taskPriority,
          status: taskStatus,
          due_at: taskDueAt ? new Date(taskDueAt).toISOString() : null,
          assignee_ids: taskAssigneeIds.map(Number),
        }),
      });
      await loadTasks(selectedProjectId, token);
      setTaskFormOpen(false);
      setProjectNotice(isEditing ? "Task updated." : "Task created.");
    } catch (err) {
      setProjectsError(err.message);
    } finally {
      setProjectBusy(false);
    }
  }

  async function handleTaskStatusChange(task, status) {
    const token = localStorage.getItem("taskflow_access_token");
    if (!token || !selectedProjectId) return;
    try {
      await request(`/projects/${selectedProjectId}/tasks/${task.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      await loadTasks(selectedProjectId, token);
    } catch (err) {
      setProjectsError(err.message);
    }
  }

  function handleTaskDragEnd({ active, over }) {
    if (!over) return;
    const task = tasks.find((item) => item.id === Number(active.id));
    if (task && ["todo", "in_progress", "done"].includes(over.id) && task.status !== over.id) {
      handleTaskStatusChange(task, over.id);
    }
  }

  async function handleDeleteTask(task) {
    if (!window.confirm(`Delete task “${task.title}”?`)) return;
    const token = localStorage.getItem("taskflow_access_token");
    if (!token || !selectedProjectId) return;
    try {
      await request(`/projects/${selectedProjectId}/tasks/${task.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadTasks(selectedProjectId, token);
      setProjectNotice("Task deleted.");
    } catch (err) {
      setProjectsError(err.message);
    }
  }

  async function handleAddProjectMember(event) {
    event.preventDefault();
    const token = localStorage.getItem("taskflow_access_token");
    if (!token || !selectedProjectId) return;
    setMemberBusy(true);
    setProjectsError("");
    try {
      await request(`/projects/${selectedProjectId}/members`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: memberEmail }),
      });
      setMemberEmail("");
      await loadProjectMembers(selectedProjectId, token);
      setProjectNotice("Project member added.");
    } catch (err) {
      setProjectsError(err.message);
    } finally {
      setMemberBusy(false);
    }
  }

  async function handleRemoveProjectMember(member) {
    if (!window.confirm(`Remove ${member.username} from this project? Their task assignments in this project will also be removed.`)) return;
    const token = localStorage.getItem("taskflow_access_token");
    if (!token || !selectedProjectId) return;
    setMemberBusy(true);
    setProjectsError("");
    try {
      await request(`/projects/${selectedProjectId}/members/${member.user_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await Promise.all([loadProjectMembers(selectedProjectId, token), loadTasks(selectedProjectId, token)]);
      setProjectNotice(`${member.username} was removed from the project.`);
    } catch (err) {
      setProjectsError(err.message);
    } finally {
      setMemberBusy(false);
    }
  }

  if (user) {
    const selectedProject = projectDetails || projects.find((project) => project.id === selectedProjectId);
    const taskColumns = [
      { key: "todo", title: "To do", tone: "slate" },
      { key: "in_progress", title: "In progress", tone: "blue" },
      { key: "done", title: "Done", tone: "green" },
    ];

    return (
      <main className="workspace-shell">
        <aside className="workspace-sidebar">
          <Brand />
          <div className="workspace-label">WORKSPACE</div>
          <button className="workspace-nav active" onClick={() => { setSelectedProjectId(null); setProjectFormOpen(false); }}><span aria-hidden="true">Projects</span> My projects</button>
          <div className="sidebar-account">
            <div className="avatar">{user.username.charAt(0).toUpperCase()}</div>
            <div className="sidebar-account-copy"><strong>{user.username}</strong><small>{user.email}</small></div>
          </div>
        </aside>
        <section className="workspace-main">
          <header className="workspace-topbar">
            <div className="workspace-breadcrumb">Projects{selectedProject && <> <span>/</span> <strong>{selectedProject.name}</strong></>}</div>
            <button className="logout-button" onClick={handleLogout}>Log out</button>
          </header>
          <div className="workspace-content">
            <div className="project-heading">
              <div><div className="eyebrow">WORKSPACE</div><h1>{selectedProject ? selectedProject.name : "My projects"}</h1><p>{selectedProject?.description || (selectedProject ? "Project details" : "Projects you own or have been invited to.")}</p></div>
              {selectedProject ? (
                <div className="project-workspace-actions">
                  <button className="secondary-button" onClick={() => { setSelectedProjectId(null); setProjectDetails(null); setTaskFormOpen(false); }}>Back</button>
                  {selectedProject.owner_id === user.id && <><button className="secondary-button" onClick={() => openEditProject(selectedProject)}>Edit project</button><button className="danger-button" onClick={() => handleDeleteProject(selectedProject)} disabled={projectBusy}>Delete</button></>}
                  <button className="primary-button new-task-button" onClick={openCreateTask}>+ <span>New task</span></button>
                </div>
              ) : <button className="primary-button new-task-button" onClick={openCreateProject}>+ <span>New project</span></button>}
            </div>

            {projectsError && <div className="notice error-notice project-notice" role="alert">{projectsError}</div>}
            {projectNotice && <div className="notice success-notice project-notice" role="status">{projectNotice}</div>}

            {projectFormOpen && (
              <section className="project-form-card project-management-card">
                <form onSubmit={handleSaveProject}>
                  <h2>{editingProjectId ? "Edit project" : "Create a project"}</h2>
                  <label htmlFor="project-name">Project name</label>
                  <input id="project-name" value={projectName} onChange={(event) => setProjectName(event.target.value)} maxLength={150} required autoFocus />
                  <label htmlFor="project-description">Description <span>(optional)</span></label>
                  <textarea id="project-description" value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} rows={3} />
                  <div className="project-form-actions">
                    <button className="secondary-button" type="button" onClick={() => setProjectFormOpen(false)}>Cancel</button>
                    <button className="primary-button" type="submit" disabled={projectBusy}>{projectBusy ? "Saving..." : editingProjectId ? "Save project details" : "Create project"}</button>
                  </div>
                </form>
                {editingProjectId && selectedProject && (
                  <div className="project-management-sections">
                    <section className="management-section">
                      <div className="management-section-heading"><div><div className="eyebrow">WORK ITEMS</div><h3>Manage tasks <span>({tasks.length})</span></h3></div><button className="primary-button" type="button" onClick={openCreateTask}>+ Add task</button></div>
                      {tasks.length ? <ul className="management-task-list">{tasks.map((task) => <li key={task.id}><span><strong>{task.title}</strong><small>{taskColumnsLabel(task.status)} · {task.priority} priority</small></span><button type="button" className="secondary-button" onClick={() => openEditTask(task)}>Edit</button><button type="button" className="danger-button" onClick={() => handleDeleteTask(task)}>Delete</button></li>)}</ul> : <p className="management-empty">No tasks yet. Add one to start planning the work.</p>}
                    </section>
                    <section className="management-section">
                      <div className="management-section-heading"><div><div className="eyebrow">COLLABORATION</div><h3>Manage members <span>({projectMembers.length})</span></h3></div></div>
                      <form className="member-add-form" onSubmit={handleAddProjectMember}>
                        <label htmlFor="manage-member-email">Add an existing TaskFlow user by email</label>
                        <div><input id="manage-member-email" type="email" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} required placeholder="teammate@example.com" /><button className="primary-button" type="submit" disabled={memberBusy}>{memberBusy ? "Saving..." : "Add member"}</button></div>
                      </form>
                      <ul className="member-list management-member-list">{projectMembers.map((member) => <li key={member.user_id}><span className="member-avatar">{member.username.charAt(0).toUpperCase()}</span><span className="member-name"><strong>{member.username}</strong><small>{member.email}</small></span><span className={`member-role ${member.role}`}>{member.role}</span>{member.role !== "owner" && <button type="button" className="danger-button" disabled={memberBusy} onClick={() => handleRemoveProjectMember(member)}>Remove</button>}</li>)}</ul>
                    </section>
                  </div>
                )}
              </section>
            )}

            {selectedProject && taskFormOpen && (
              <form className="project-form-card" onSubmit={handleSaveTask}>
                <h2>{editingTaskId ? "Edit task" : "Add a task"}</h2>
                <label htmlFor="task-title">Task title</label>
                <input id="task-title" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} maxLength={200} required autoFocus />
                <label htmlFor="task-description">Description <span>(optional)</span></label>
                <textarea id="task-description" value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} rows={3} />
                <div className="task-form-row">
                  <div><label htmlFor="task-priority">Priority</label><select id="task-priority" value={taskPriority} onChange={(event) => setTaskPriority(event.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
                  <div><label htmlFor="task-due">Due date <span>(optional)</span></label><input id="task-due" type="datetime-local" value={taskDueAt} onChange={(event) => setTaskDueAt(event.target.value)} /></div>
                </div>
                <label htmlFor="task-status">Status</label>
                <select id="task-status" value={taskStatus} onChange={(event) => setTaskStatus(event.target.value)}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select>
                <label htmlFor="task-assignees">Assignees <span>(optional; Ctrl-click to select multiple)</span></label>
                <select id="task-assignees" multiple size={Math.min(4, Math.max(projectMembers.length, 2))} value={taskAssigneeIds} onChange={(event) => setTaskAssigneeIds(Array.from(event.target.selectedOptions, (option) => option.value))}>
                  {projectMembers.map((member) => <option key={member.user_id} value={member.user_id}>{member.username} ({member.role})</option>)}
                </select>
                <div className="project-form-actions">
                  <button className="secondary-button" type="button" onClick={() => setTaskFormOpen(false)}>Cancel</button>
                  <button className="primary-button" type="submit" disabled={projectBusy}>{projectBusy ? "Saving..." : editingTaskId ? "Save task" : "Add task"}</button>
                </div>
              </form>
            )}

            {selectedProject ? (
              <>
                {tasksLoading ? (
                  <div className="project-empty-state">Loading project tasks...</div>
                ) : (
                  <>
                  <p className="board-help">Drag a task by its handle into To do, In progress, or Done. Its status is saved when you drop it.</p>
                  <DndContext sensors={sensors} onDragEnd={handleTaskDragEnd}>
                    <div className="task-board project-task-board">
                      {taskColumns.map((column) => (
                        <DroppableTaskColumn
                          key={column.key}
                          column={column}
                          tasks={tasks.filter((task) => task.status === column.key)}
                          onAddTask={openCreateTask}
                          onEditTask={openEditTask}
                          onDeleteTask={handleDeleteTask}
                          onStatusChange={handleTaskStatusChange}
                          members={projectMembers}
                        />
                      ))}
                    </div>
                  </DndContext>
                  </>
                )}
                <section className="members-panel">
                  <div className="members-panel-heading"><div><div className="eyebrow">COLLABORATION</div><h2>Project members</h2></div></div>
                  {selectedProject.owner_id === user.id && (
                    <form className="member-add-form" onSubmit={handleAddProjectMember}>
                      <label htmlFor="member-email">Add an existing TaskFlow user by email</label>
                      <div><input id="member-email" type="email" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} required placeholder="teammate@example.com" /><button className="primary-button" type="submit" disabled={memberBusy}>{memberBusy ? "Adding..." : "Add member"}</button></div>
                    </form>
                  )}
                  <ul className="member-list">
                    {projectMembers.map((member) => <li key={member.user_id}><span className="member-avatar">{member.username.charAt(0).toUpperCase()}</span><span className="member-name"><strong>{member.username}</strong><small>{member.email}</small></span><span className={`member-role ${member.role}`}>{member.role}</span></li>)}
                  </ul>
                </section>
              </>
            ) : projectsLoading ? (
              <div className="project-empty-state">Loading your projects...</div>
            ) : projects.length ? (
              <div className="project-grid">
                {projects.map((project) => (
                  <article className="project-card" key={project.id}>
                    <div className="project-card-mark">{project.name.trim().charAt(0).toUpperCase()}</div>
                    <h2>{project.name}</h2>
                    <p>{project.description || "No description provided."}</p>
                    <div className="project-card-footer"><span>Created {new Date(project.created_at).toLocaleDateString()}</span><button onClick={() => { setProjectDetails(null); setSelectedProjectId(project.id); setProjectFormOpen(false); setProjectNotice(""); }}>Open project <span aria-hidden="true">-&gt;</span></button></div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="project-empty-state"><div className="empty-icon">+</div><h2>No projects yet</h2><p>Create your first project to get started.</p><button className="primary-button" onClick={openCreateProject}>Create a project</button></div>
            )}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Brand />
        <p className="eyebrow">YOUR TEAM WORKSPACE</p>
        <h1>{page === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="auth-subtitle">
          {page === "login" ? "Log in to continue to TaskFlow." : "Verify your email, then choose your login details."}
        </p>

        {error && <div className="notice error-notice" role="alert">{error}</div>}
        {message && <div className="notice success-notice" role="status">{message}</div>}

        {page === "login" ? (
          <form className="auth-form" onSubmit={handleLogin}>
            <label htmlFor="login-username">Username</label>
            <input id="login-username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required minLength={3} maxLength={50} />
            <label htmlFor="login-password">Password</label>
            <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            <button className="primary-button full-width" type="submit" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
          </form>
        ) : (
          <>
            {signupStep === "email" && (
              <>
                <form className="auth-form" onSubmit={handleSendCode}>
                  <label htmlFor="signup-email">Email address</label>
                  <input id="signup-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                  <button className="primary-button full-width" type="submit" disabled={busy}>{busy ? "Sending…" : "Send verification code"}</button>
                </form>
                {GOOGLE_CLIENT_ID && (
                  <>
                    <div className="auth-divider"><span>or sign up with</span></div>
                    <div className="google-button">
                      <GoogleLogin
                        onSuccess={handleGoogleSignup}
                        onError={() => setError("Google signup could not be completed. Please try again.")}
                        text="signup_with"
                        shape="rectangular"
                        width="320"
                      />
                    </div>
                  </>
                )}
              </>
            )}
            {signupStep === "code" && (
              <form className="auth-form" onSubmit={handleVerifyCode}>
                <label htmlFor="signup-code">Six-digit email code</label>
                <input id="signup-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} required />
                <button className="primary-button full-width" type="submit" disabled={busy}>{busy ? "Checking…" : "Verify email"}</button>
                <button className="text-button" type="button" onClick={() => { setSignupStep("email"); clearNotices(); }}>Use a different email</button>
              </form>
            )}
            {signupStep === "credentials" && (
              <form className="auth-form" onSubmit={handleRegister}>
                <label htmlFor="signup-username">Username</label>
                <input id="signup-username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required minLength={3} maxLength={50} pattern="[A-Za-z0-9_]+" />
                <small className="field-help">Use 3–50 letters, numbers, or underscores.</small>
                <label htmlFor="signup-password">Password</label>
                <input id="signup-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} maxLength={128} />
                <button className="primary-button full-width" type="submit" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
              </form>
            )}
          </>
        )}

        <div className="auth-switch">
          {page === "login" ? "New to TaskFlow?" : "Already have an account?"}
          <button type="button" onClick={() => { setPage(page === "login" ? "signup" : "login"); setSignupStep("email"); clearNotices(); }}>
            {page === "login" ? "Sign up" : "Log in"}
          </button>
        </div>
      </section>
    </main>
  );
}

function DroppableTaskColumn({ column, tasks, onAddTask, onEditTask, onDeleteTask, onStatusChange, members }) {
  const { isOver, setNodeRef } = useDroppable({ id: column.key });
  return (
    <section ref={setNodeRef} className={`task-column${isOver ? " drop-target" : ""}`}>
      <div className="task-column-heading"><div><span className={`status-dot ${column.tone}`} /><h2>{column.title}</h2><span className="count">{tasks.length}</span></div></div>
      {tasks.length ? tasks.map((task) => (
        <TaskCard key={task.id} task={task} members={members} onEdit={onEditTask} onDelete={onDeleteTask} onStatusChange={onStatusChange} />
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
        <div><button type="button" aria-label={`Edit ${task.title}`} onClick={() => onEdit(task)}>Edit</button><button type="button" aria-label={`Delete ${task.title}`} onClick={() => onDelete(task)}>×</button></div>
      </div>
      <h3>{task.title}</h3>
      {task.description && <p>{task.description}</p>}
      <div className="task-assignees">Created by {members.find((member) => member.user_id === task.created_by_id)?.username || `User ${task.created_by_id}`}</div>
      {task.assignee_ids?.length > 0 && <div className="task-assignees">{task.assignee_ids.map((id) => members.find((member) => member.user_id === id)?.username || `User ${id}`).join(", ")}</div>}
      {task.due_at && <small>Due {new Date(task.due_at).toLocaleString()}</small>}
      <label className="task-status-label" htmlFor={`task-status-${task.id}`}>Move to</label>
      <select id={`task-status-${task.id}`} value={task.status} onChange={(event) => onStatusChange(task, event.target.value)}>
        <option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option>
      </select>
    </article>
  );
}

function Brand() {
  return <a className="auth-brand" href="#home"><span className="brand-mark">T</span><span>taskflow</span></a>;
}
