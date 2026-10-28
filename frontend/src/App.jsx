import React, { Suspense, lazy, useEffect, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { DndContext, PointerSensor, useDroppable, useDraggable, useSensor, useSensors } from "@dnd-kit/core";
import { convertDateTimeInput, dateTimeInputToUtc, formatTaskDeadline, taskDeadlineTone, utcDateTimeToInput } from "./deadlineTime.js";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const taskColumnsLabel = (status) => ({ todo: "To do", in_progress: "In progress", done: "Done" }[status] || status);
const ProgressPanel = lazy(() => import("./components/ProgressPanel.jsx"));

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
  const [taskDueTimezone, setTaskDueTimezone] = useState("Asia/Kolkata");
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [taskAssigneeIds, setTaskAssigneeIds] = useState([]);
  const [taskSubtasks, setTaskSubtasks] = useState([]);
  const [aiDraft, setAiDraft] = useState(null);
  const [aiLogId, setAiLogId] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [projectMembers, setProjectMembers] = useState([]);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberBusy, setMemberBusy] = useState(false);
  const [projectView, setProjectView] = useState("board");
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [taskDetail, setTaskDetail] = useState(null);
  const [subtaskDetail, setSubtaskDetail] = useState(null);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [subtaskDescription, setSubtaskDescription] = useState("");
  const [subtaskEditId, setSubtaskEditId] = useState(null);
  const [commentBody, setCommentBody] = useState("");
  const [activityItems, setActivityItems] = useState([]);
  const [activityFilter, setActivityFilter] = useState("");
  const [analyticsData, setAnalyticsData] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

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

  async function loadNotifications(token = localStorage.getItem("taskflow_access_token")) {
    if (!token) return;
    try {
      const result = await request("/notifications", { headers: { Authorization: `Bearer ${token}` } });
      setNotifications(result.items || []);
      setNotificationUnread(result.unread_count || 0);
    } catch (err) {
      setProjectsError(err.message);
    }
  }

  async function loadTaskDetail(taskId, token = localStorage.getItem("taskflow_access_token")) {
    if (!token || !taskId) return;
    try {
      const result = await request(`/tasks/${taskId}`, { headers: { Authorization: `Bearer ${token}` } });
      setTaskDetail(result);
      setTaskDetailOpen(true);
      setSubtaskDetail(null);
    } catch (err) {
      setProjectsError(err.message);
    }
  }

  async function loadSubtaskDetail(subtaskId, token = localStorage.getItem("taskflow_access_token")) {
    if (!token || !subtaskId) return;
    try {
      const result = await request(`/subtasks/${subtaskId}`, { headers: { Authorization: `Bearer ${token}` } });
      setSubtaskDetail(result);
    } catch (err) {
      setProjectsError(err.message);
    }
  }

  async function loadActivity(projectId, userId = activityFilter) {
    const token = localStorage.getItem("taskflow_access_token");
    if (!token || !projectId) return;
    try {
      const query = userId ? `?user_id=${userId}` : "";
      setActivityItems(await request(`/projects/${projectId}/activity${query}`, { headers: { Authorization: `Bearer ${token}` } }));
    } catch (err) {
      setProjectsError(err.message);
    }
  }

  async function loadAnalytics(projectId) {
    const token = localStorage.getItem("taskflow_access_token");
    if (!token || !projectId) return;
    try {
      setAnalyticsData(await request(`/projects/${projectId}/analytics`, { headers: { Authorization: `Bearer ${token}` } }));
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
      setTaskDetail(null);
      setSubtaskDetail(null);
      return;
    }
    setProjectView("board");
    setTaskDetail(null);
    setSubtaskDetail(null);
    setProjectDetails(null);
    loadProject(selectedProjectId);
    loadTasks(selectedProjectId);
    loadProjectMembers(selectedProjectId);
  }, [selectedProjectId]);

  useEffect(() => {
    if (!user) return undefined;
    loadNotifications();
    const timer = window.setInterval(() => loadNotifications(), 60000);
    return () => window.clearInterval(timer);
  }, [user]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

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
      if (result.access_token) {
        localStorage.setItem("taskflow_access_token", result.access_token);
        await loadCurrentUser(result.access_token);
        await Promise.all([loadProjects(result.access_token), loadNotifications(result.access_token)]);
        setMessage("Signed in with Google.");
        return;
      }
      if (page === "login") setPage("signup");
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
    setNotifications([]);
    setNotificationUnread(0);
    setTaskDetail(null);
    setSubtaskDetail(null);
    setTaskDetailOpen(false);
    setProjectView("board");
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
    setTaskDueTimezone("Asia/Kolkata");
    setTaskAssigneeIds([]);
    setTaskSubtasks([]);
    setAiDraft(null);
    setAiLogId(null);
    setTaskFormOpen(true);
    setProjectNotice("");
  }

  function openEditTask(task) {
    setEditingTaskId(task.id);
    setTaskTitle(task.title);
    setTaskDescription(task.description || "");
    setTaskPriority(task.priority);
    setTaskStatus(task.status);
    const timezone = task.due_timezone || "UTC";
    setTaskDueTimezone(timezone);
    setTaskDueAt(utcDateTimeToInput(task.due_at, timezone));
    setTaskAssigneeIds((task.assignee_ids || []).map(String));
    setTaskSubtasks([]);
    setAiDraft(null);
    setAiLogId(null);
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
          due_at: taskDueAt ? dateTimeInputToUtc(taskDueAt, taskDueTimezone) : null,
          due_timezone: taskDueTimezone,
          assignee_ids: taskAssigneeIds.map(Number),
          subtasks: taskSubtasks.map((item) => ({ ...item, is_ai_generated: Boolean(item.is_ai_generated) })),
          ...(isEditing
            ? (aiLogId ? { ai_log_id: aiLogId } : {})
            : (aiDraft ? { ai_log: { prompt_sent: aiDraft.prompt_sent, ai_response: aiDraft.ai_response } } : {})),
        }),
      });
      await loadTasks(selectedProjectId, token);
      setTaskFormOpen(false);
      setProjectNotice(isEditing ? "Task updated." : "Task created.");
      setAiDraft(null);
      setAiLogId(null);
    } catch (err) {
      setProjectsError(err.message);
    } finally {
      setProjectBusy(false);
    }
  }

  async function handleAiAssist() {
    const token = localStorage.getItem("taskflow_access_token");
    if (!token || !selectedProjectId || !taskTitle.trim()) {
      setProjectsError("Enter a task title before asking AI Assist.");
      return;
    }
    setAiLoading(true);
    setProjectsError("");
    try {
      const path = editingTaskId
        ? `/tasks/${editingTaskId}/ai-assist`
        : `/projects/${selectedProjectId}/tasks/ai-assist`;
      const result = await request(path, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: taskTitle.trim() }),
      });
      setTaskDescription(result.description);
      setTaskSubtasks(result.subtasks.map((item) => ({ ...item, is_ai_generated: true })));
      setAiDraft(result);
      setAiLogId(result.ai_log_id || null);
      setProjectNotice("AI suggestions are ready. Review or edit them before saving.");
    } catch (err) {
      setProjectsError(err.message);
    } finally {
      setAiLoading(false);
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

  async function handleViewTask(task) {
    setTaskDetail(null);
    setSubtaskDetail(null);
    setTaskDetailOpen(true);
    await loadTaskDetail(task.id);
  }

  async function handleSaveSubtask(event) {
    event.preventDefault();
    const token = localStorage.getItem("taskflow_access_token");
    if (!token || !taskDetail) return;
    try {
      await request(subtaskEditId ? `/subtasks/${subtaskEditId}` : `/tasks/${taskDetail.id}/subtasks`, {
        method: subtaskEditId ? "PUT" : "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: subtaskTitle, description: subtaskDescription || null, is_ai_generated: false }),
      });
      setSubtaskEditId(null);
      setSubtaskTitle("");
      setSubtaskDescription("");
      await loadTaskDetail(taskDetail.id, token);
      await loadTasks(taskDetail.project_id, token);
    } catch (err) {
      setProjectsError(err.message);
    }
  }

  async function handleToggleSubtask(subtask, isDone) {
    const token = localStorage.getItem("taskflow_access_token");
    if (!token || !taskDetail) return;
    try {
      await request(`/subtasks/${subtask.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_done: isDone }),
      });
      await loadTaskDetail(taskDetail.id, token);
      if (subtaskDetail?.id === subtask.id) await loadSubtaskDetail(subtask.id, token);
    } catch (err) {
      setProjectsError(err.message);
    }
  }

  async function handleDeleteSubtask(subtask) {
    if (!window.confirm(`Delete subtask “${subtask.title}”? Its comments and history will also be removed.`)) return;
    const token = localStorage.getItem("taskflow_access_token");
    if (!token || !taskDetail) return;
    try {
      await request(`/subtasks/${subtask.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      setSubtaskDetail(null);
      await loadTaskDetail(taskDetail.id, token);
    } catch (err) {
      setProjectsError(err.message);
    }
  }

  async function handleAddComment(event) {
    event.preventDefault();
    const token = localStorage.getItem("taskflow_access_token");
    if (!token || !subtaskDetail || !commentBody.trim()) return;
    try {
      await request(`/subtasks/${subtaskDetail.id}/comments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ body: commentBody }),
      });
      setCommentBody("");
      await loadSubtaskDetail(subtaskDetail.id, token);
    } catch (err) {
      setProjectsError(err.message);
    }
  }

  async function handleMarkAllRead() {
    const token = localStorage.getItem("taskflow_access_token");
    if (!token) return;
    try {
      await request("/notifications/read-all", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      await loadNotifications(token);
    } catch (err) {
      setProjectsError(err.message);
    }
  }

  async function handleOpenNotification(item) {
    const token = localStorage.getItem("taskflow_access_token");
    if (!token) return;
    try {
      await request(`/notifications/${item.id}/read`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
      await loadNotifications(token);
      setNotificationsOpen(false);
      if (item.project_id) {
        setSelectedProjectId(item.project_id);
        setProjectView("board");
      }
      if (item.task_id) await loadTaskDetail(item.task_id, token);
      if (item.subtask_id) await loadSubtaskDetail(item.subtask_id, token);
    } catch (err) {
      setProjectsError(err.message);
    }
  }

  function handleProjectViewChange(view) {
    setProjectView(view);
    setTaskDetailOpen(false);
    setSubtaskDetail(null);
    if (view === "activity") loadActivity(selectedProjectId, "");
    if (view === "progress") loadAnalytics(selectedProjectId);
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
            <div className="topbar-actions">
              <div className="notification-wrap">
                <button className="notification-button" type="button" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen(!notificationsOpen)}>
                  Notifications {notificationUnread > 0 && <span className="notification-count">{notificationUnread}</span>}
                </button>
                {notificationsOpen && <section className="notification-menu">
                  <div className="notification-menu-heading"><strong>Notifications</strong><button type="button" className="text-button" onClick={handleMarkAllRead}>Mark all read</button></div>
                  {notifications.length ? notifications.map((item) => <button type="button" key={item.id} className={`notification-item${item.is_read ? " read" : ""}`} onClick={() => handleOpenNotification(item)}><span>{item.message}</span><small>{new Date(item.created_at).toLocaleString()}</small></button>) : <p className="notification-empty">You’re all caught up.</p>}
                </section>}
              </div>
              <button className="logout-button" onClick={handleLogout}>Log out</button>
            </div>
          </header>
          <div className="workspace-content">
            <div className="project-heading">
              <div><div className="eyebrow">WORKSPACE</div><h1>{selectedProject ? selectedProject.name : "My projects"}</h1><p>{selectedProject?.description || (selectedProject ? "Project details" : "Projects you own or have been invited to.")}</p></div>
              {selectedProject ? (
                <div className="project-workspace-actions">
                  <button className="secondary-button" onClick={() => { setSelectedProjectId(null); setProjectDetails(null); setTaskFormOpen(false); }}>Back</button>
                  {selectedProject.owner_id === user.id && <><button className="secondary-button" onClick={() => openEditProject(selectedProject)}>Edit project</button><button className="danger-button" onClick={() => handleDeleteProject(selectedProject)} disabled={projectBusy}>Delete</button></>}
                  <button className="primary-button new-task-button" onClick={openCreateTask}>+ <span>New task</span></button>
                  <div className="project-view-tabs" role="tablist" aria-label="Project views">
                    {[ ["board", "Board"], ["activity", "Activity"], ["progress", "Progress"] ].map(([view, label]) => <button type="button" role="tab" aria-selected={projectView === view} className={projectView === view ? "active" : ""} key={view} onClick={() => handleProjectViewChange(view)}>{label}</button>)}
                  </div>
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
                      {tasks.length ? <ul className="management-task-list">{tasks.map((task) => <li key={task.id}><span><strong className={taskDeadlineTone(task, clockNow)}>{task.title}</strong><small>{taskColumnsLabel(task.status)} · {task.priority} priority</small></span><button type="button" className="secondary-button" onClick={() => openEditTask(task)}>Edit</button><button type="button" className="danger-button" onClick={() => handleDeleteTask(task)}>Delete</button></li>)}</ul> : <p className="management-empty">No tasks yet. Add one to start planning the work.</p>}
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
                <div className="task-subtask-heading"><strong>Subtasks</strong><button className="secondary-button" type="button" onClick={() => setTaskSubtasks([...taskSubtasks, { title: "", description: "", is_ai_generated: false }])}>+ Add subtask</button></div>
                <button className="ai-assist-button" type="button" onClick={handleAiAssist} disabled={aiLoading || !taskTitle.trim()}>{aiLoading ? "Generating suggestions…" : "AI Assist: draft description and subtasks"}</button>
                {taskSubtasks.map((item, index) => <div className="task-subtask-draft" key={`${index}-${item.title}`}>
                  <label htmlFor={`task-subtask-title-${index}`}>Subtask {index + 1}</label>
                  <div className="task-subtask-draft-title"><input id={`task-subtask-title-${index}`} value={item.title} onChange={(event) => setTaskSubtasks(taskSubtasks.map((current, itemIndex) => itemIndex === index ? { ...current, title: event.target.value } : current))} maxLength={200} required /> <button type="button" className="danger-button" onClick={() => setTaskSubtasks(taskSubtasks.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>
                  <textarea aria-label={`Description for subtask ${index + 1}`} value={item.description || ""} onChange={(event) => setTaskSubtasks(taskSubtasks.map((current, itemIndex) => itemIndex === index ? { ...current, description: event.target.value } : current))} rows={2} />
                </div>)}
                <div className="task-form-row">
                  <div><label htmlFor="task-priority">Priority</label><select id="task-priority" value={taskPriority} onChange={(event) => setTaskPriority(event.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
                  <div className="deadline-input-group">
                    <label htmlFor="task-due">Due date <span>(optional)</span></label>
                    <input id="task-due" type="datetime-local" value={taskDueAt} onChange={(event) => setTaskDueAt(event.target.value)} />
                    <label htmlFor="task-due-timezone">Time zone</label>
                    <select id="task-due-timezone" value={taskDueTimezone} onChange={(event) => {
                      const nextTimezone = event.target.value;
                      setTaskDueAt((current) => convertDateTimeInput(current, taskDueTimezone, nextTimezone));
                      setTaskDueTimezone(nextTimezone);
                    }}>
                      <option value="UTC">UTC</option>
                      <option value="Asia/Kolkata">IST (India)</option>
                    </select>
                  </div>
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
              projectView === "activity" ? (
                <ActivityPanel items={activityItems} members={projectMembers} filter={activityFilter} onFilter={(value) => { setActivityFilter(value); loadActivity(selectedProjectId, value); }} />
              ) : projectView === "progress" ? (
                <Suspense fallback={<div className="project-empty-state">Loading progress charts...</div>}><ProgressPanel data={analyticsData} /></Suspense>
              ) : (
              <>
                {taskDetailOpen && (taskDetail ? (
                  <TaskDetailPanel
                    task={taskDetail}
                    clockNow={clockNow}
                    editId={subtaskEditId}
                    title={subtaskTitle}
                    description={subtaskDescription}
                    onTitle={setSubtaskTitle}
                    onDescription={setSubtaskDescription}
                    onClose={() => { setTaskDetailOpen(false); setSubtaskDetail(null); }}
                    onOpenSubtask={loadSubtaskDetail}
                    onToggleSubtask={handleToggleSubtask}
                    onDeleteSubtask={handleDeleteSubtask}
                    onEditSubtask={(item) => { setSubtaskEditId(item.id); setSubtaskTitle(item.title); setSubtaskDescription(item.description || ""); }}
                    onNewSubtask={() => { setSubtaskEditId(null); setSubtaskTitle(""); setSubtaskDescription(""); }}
                    onSaveSubtask={handleSaveSubtask}
                  />
                ) : <div className="project-empty-state">Loading task details...</div>)}
                {subtaskDetail && <SubtaskDetailPanel subtask={subtaskDetail} commentBody={commentBody} onCommentBody={setCommentBody} onAddComment={handleAddComment} onClose={() => setSubtaskDetail(null)} />}
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
                          onViewTask={handleViewTask}
                          onDeleteTask={handleDeleteTask}
                          onStatusChange={handleTaskStatusChange}
                          members={projectMembers}
                          clockNow={clockNow}
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
              )
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

        {page === "login" && GOOGLE_CLIENT_ID && (
          <>
            <div className="auth-divider"><span>or</span></div>
            <div className="google-button">
              <GoogleLogin
                onSuccess={handleGoogleSignup}
                onError={() => setError("Google sign-in could not be completed. Please try again.")}
                text="signin_with"
                shape="rectangular"
                width="320"
              />
            </div>
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

function DroppableTaskColumn({ column, tasks, onAddTask, onEditTask, onViewTask, onDeleteTask, onStatusChange, members, clockNow }) {
  const { isOver, setNodeRef } = useDroppable({ id: column.key });
  return (
    <section ref={setNodeRef} className={`task-column${isOver ? " drop-target" : ""}`}>
      <div className="task-column-heading"><div><span className={`status-dot ${column.tone}`} /><h2>{column.title}</h2><span className="count">{tasks.length}</span></div></div>
      {tasks.length ? tasks.map((task) => (
        <TaskCard key={task.id} task={task} members={members} clockNow={clockNow} onEdit={onEditTask} onView={onViewTask} onDelete={onDeleteTask} onStatusChange={onStatusChange} />
      )) : <div className="empty-column"><span>No tasks</span></div>}
      <button className="add-task" type="button" onClick={onAddTask}>+ Add task</button>
    </section>
  );
}

function TaskCard({ task, members, clockNow, onEdit, onView, onDelete, onStatusChange }) {
  const { attributes, isDragging, listeners, setNodeRef, transform } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <article ref={setNodeRef} style={style} className={`task-card${isDragging ? " dragging" : ""}`}>
      <div className="task-card-top">
        <div className="task-card-tools">
          <button className="drag-handle" type="button" aria-label={`Drag ${task.title}`} {...listeners} {...attributes}>⠿</button>
          <span className={`priority-tag ${task.priority}`}>{task.priority}</span>
        </div>
        <div><button type="button" aria-label={`View ${task.title}`} onClick={() => onView(task)}>Details</button><button type="button" aria-label={`Edit ${task.title}`} onClick={() => onEdit(task)}>Edit</button><button type="button" aria-label={`Delete ${task.title}`} onClick={() => onDelete(task)}>×</button></div>
      </div>
      <h3 className={taskDeadlineTone(task, clockNow)}>{task.title}</h3>
      {task.description && <p>{task.description}</p>}
      <div className="task-assignees">Created by {members.find((member) => member.user_id === task.created_by_id)?.username || `User ${task.created_by_id}`}</div>
      {task.assignee_ids?.length > 0 && <div className="task-assignees">{task.assignee_ids.map((id) => members.find((member) => member.user_id === id)?.username || `User ${id}`).join(", ")}</div>}
      {task.due_at && <small>Due {formatTaskDeadline(task)}</small>}
      <label className="task-status-label" htmlFor={`task-status-${task.id}`}>Move to</label>
      <select id={`task-status-${task.id}`} value={task.status} onChange={(event) => onStatusChange(task, event.target.value)}>
        <option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option>
      </select>
    </article>
  );
}

function TaskDetailPanel({ task, clockNow, editId, title, description, onTitle, onDescription, onClose, onOpenSubtask, onToggleSubtask, onDeleteSubtask, onEditSubtask, onNewSubtask, onSaveSubtask }) {
  return (
    <section className="detail-panel task-detail-panel">
      <div className="detail-panel-heading"><div><div className="eyebrow">TASK DETAILS</div><h2 className={taskDeadlineTone(task, clockNow)}>{task.title}</h2></div><button className="secondary-button" type="button" onClick={onClose}>Close</button></div>
      <p className="task-detail-description">{task.description || "No description."}</p>
      <div className="task-detail-meta"><span>Status: {taskColumnsLabel(task.status)}</span><span>Priority: {task.priority}</span><span>Created by: {task.created_by_username}</span>{task.due_at && <span>Due: {formatTaskDeadline(task)}</span>}</div>
      <div className="detail-panel-heading subtasks-heading"><div><div className="eyebrow">BREAKDOWN</div><h3>Subtasks ({task.subtasks.length})</h3></div><button className="primary-button" type="button" onClick={onNewSubtask}>+ Add subtask</button></div>
      {task.subtasks.length ? <ul className="detail-subtask-list">{task.subtasks.map((item) => <li key={item.id}>
        <input type="checkbox" checked={item.is_done} aria-label={`Mark ${item.title} ${item.is_done ? "not done" : "done"}`} onChange={(event) => onToggleSubtask(item, event.target.checked)} />
        <button type="button" className={`subtask-title-button${item.is_done ? " complete" : ""}`} onClick={() => onOpenSubtask(item.id)}>{item.title}</button>
        {item.is_ai_generated && <span className="ai-generated-tag">AI</span>}
        <button className="text-button" type="button" onClick={() => onEditSubtask(item)}>Edit</button>
        <button className="text-button danger-text" type="button" onClick={() => onDeleteSubtask(item)}>Delete</button>
      </li>)}</ul> : <p className="management-empty">No subtasks yet. Break this task into smaller pieces.</p>}
      <form className="subtask-edit-form" onSubmit={onSaveSubtask}>
        <h4>{editId ? "Edit subtask" : "Add a subtask"}</h4>
        <label htmlFor="detail-subtask-title">Title</label><input id="detail-subtask-title" value={title} onChange={(event) => onTitle(event.target.value)} maxLength={200} minLength={1} required />
        <label htmlFor="detail-subtask-description">Description (optional)</label><textarea id="detail-subtask-description" value={description} onChange={(event) => onDescription(event.target.value)} rows={2} />
        <button className="primary-button" type="submit">{editId ? "Save subtask" : "Add subtask"}</button>
      </form>
    </section>
  );
}

function SubtaskDetailPanel({ subtask, commentBody, onCommentBody, onAddComment, onClose }) {
  return (
    <section className="detail-panel subtask-detail-panel">
      <div className="detail-panel-heading"><div><div className="eyebrow">SUBTASK · {subtask.task_title}</div><h3>{subtask.title}</h3></div><button className="secondary-button" type="button" onClick={onClose}>Close</button></div>
      <p className="task-detail-description">{subtask.description || "No description."}</p>
      <label className="subtask-completion"><input type="checkbox" checked={subtask.is_done} readOnly /> {subtask.is_done ? "Completed" : "Not completed"}</label>
      <h4>Comments</h4>
      <ul className="subtask-comments">{subtask.comments.length ? subtask.comments.map((comment) => <li key={comment.id}><strong>{comment.username}</strong><p>{comment.body}</p><small>{new Date(comment.created_at).toLocaleString()}</small></li>) : <li className="management-empty">No comments yet.</li>}</ul>
      <form className="comment-form" onSubmit={onAddComment}><label htmlFor="new-subtask-comment">Add a comment</label><textarea id="new-subtask-comment" value={commentBody} onChange={(event) => onCommentBody(event.target.value)} maxLength={10000} rows={3} required /><button className="primary-button" type="submit">Post comment</button></form>
      <h4>Change history</h4>
      <ol className="subtask-history">{subtask.history.length ? subtask.history.map((entry, index) => <li key={`${entry.action}-${index}`}><strong>{entry.username}</strong>{activityDetailsText(entry)}{entry.details?.title ? ` “${entry.details.title}”` : ""}<small>{new Date(entry.created_at).toLocaleString()}</small></li>) : <li className="management-empty">No history yet.</li>}</ol>
    </section>
  );
}

function activityLabel(action) {
  return ({
    project_created: "created the project",
    project_updated: "updated the project",
    task_created: "created a task",
    task_updated: "updated a task",
    task_assigned: "assigned a task",
    task_deleted: "deleted a task",
    status_changed: "changed a task status",
    subtask_created: "created a subtask",
    subtask_updated: "updated a subtask",
    subtask_deleted: "deleted a subtask",
    comment_added: "commented on a subtask",
    member_added: "added a project member",
    member_removed: "removed a project member",
  })[action] || action.replaceAll("_", " ");
}

function activityDetailsText(entry) {
  const changes = entry.details?.changes || {};
  if (entry.action === "subtask_updated" && changes.is_done) {
    return changes.is_done.after ? " completed this subtask" : " reopened this subtask";
  }
  if (entry.action === "subtask_updated" && changes.title) return " renamed this subtask";
  if (entry.action === "subtask_updated" && changes.description) return " updated this subtask’s description";
  return ` ${activityLabel(entry.action)}`;
}

function activityFeedText(item) {
  if (item.action === "status_changed" && item.details?.after === "done") return "completed a task";
  if (item.action === "status_changed" && item.details?.before === "done") return "reopened a task";
  if (item.action === "status_changed") return `moved a task to ${taskColumnsLabel(item.details?.after).toLowerCase()}`;
  return activityLabel(item.action);
}

function ActivityPanel({ items, members, filter, onFilter }) {
  return <section className="insights-panel"><div className="detail-panel-heading"><div><div className="eyebrow">PROJECT HISTORY</div><h2>Activity</h2></div><label className="activity-filter">Filter by member<select value={filter} onChange={(event) => onFilter(event.target.value)}><option value="">Everyone</option>{members.map((member) => <option key={member.user_id} value={member.user_id}>{member.username}</option>)}</select></label></div>
    {items.length ? <ol className="activity-feed">{items.map((item) => <li key={item.id}><span className="activity-avatar">{item.username.charAt(0).toUpperCase()}</span><div><p><strong>{item.username}</strong> {activityFeedText(item)}{item.details?.title ? ` “${item.details.title}”` : item.details?.name ? ` “${item.details.name}”` : ""}</p><small>{new Date(item.created_at).toLocaleString()}</small></div></li>)}</ol> : <p className="management-empty">No activity recorded yet.</p>}
  </section>;
}

function Brand() {
  return <a className="auth-brand" href="#home"><span className="brand-mark">T</span><span>taskflow</span></a>;
}
