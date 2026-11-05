import React, { useEffect, useState } from "react";

import { ACCESS_TOKEN_KEY } from "../api/auth";
import {
  addProjectMember,
  deleteProject,
  deleteTask,
  getProject,
  listProjectMembers,
  listProjects,
  listTasks,
  removeProjectMember,
  saveProject,
  saveTask,
} from "../api/workspace";
import ProjectEditor from "../components/workspace/ProjectEditor";
import ProjectList from "../components/workspace/ProjectList";
import ProjectMembers from "../components/workspace/ProjectMembers";
import TaskBoard from "../components/workspace/TaskBoard";
import TaskForm from "../components/workspace/TaskForm";
import WorkspaceSidebar from "../components/workspace/WorkspaceSidebar";

export default function WorkspacePage({ user, onLogout }) {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [projectDetails, setProjectDetails] = useState(null);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");
  const [projectNotice, setProjectNotice] = useState("");

  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectBusy, setProjectBusy] = useState(false);

  const [tasks, setTasks] = useState([]);
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

  function getToken() {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  async function refreshProjects(token = getToken()) {
    if (!token) return;
    setProjectsLoading(true);
    setProjectsError("");
    try {
      setProjects(await listProjects(token));
    } catch (error) {
      setProjectsError(error.message);
    } finally {
      setProjectsLoading(false);
    }
  }

  async function refreshTasks(projectId, token = getToken()) {
    if (!projectId || !token) return;
    try {
      setTasks(await listTasks(token, projectId));
    } catch (error) {
      setProjectsError(error.message);
    }
  }

  async function refreshMembers(projectId, token = getToken()) {
    if (!projectId || !token) return;
    try {
      setProjectMembers(await listProjectMembers(token, projectId));
    } catch (error) {
      setProjectsError(error.message);
    }
  }

  useEffect(() => {
    refreshProjects();
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!selectedProjectId || !token) {
      setProjectDetails(null);
      setTasks([]);
      setProjectMembers([]);
      setTasksLoading(false);
      return;
    }

    let active = true;
    setProjectDetails(null);
    setTasksLoading(true);
    setProjectsError("");
    Promise.all([
      getProject(token, selectedProjectId),
      listTasks(token, selectedProjectId),
      listProjectMembers(token, selectedProjectId),
    ])
      .then(([project, projectTasks, members]) => {
        if (!active) return;
        setProjectDetails(project);
        setTasks(projectTasks);
        setProjectMembers(members);
      })
      .catch((error) => { if (active) setProjectsError(error.message); })
      .finally(() => { if (active) setTasksLoading(false); });

    return () => { active = false; };
  }, [selectedProjectId]);

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
    const token = getToken();
    if (!token) return;
    setProjectBusy(true);
    setProjectsError("");
    setProjectNotice("");
    const editing = editingProjectId !== null;
    try {
      const project = await saveProject(token, editingProjectId, {
        name: projectName,
        description: projectDescription.trim() || null,
      });
      await refreshProjects(token);
      setProjectDetails(project);
      setSelectedProjectId(project.id);
      setProjectFormOpen(false);
      setProjectNotice(editing ? "Project updated." : "Project created.");
    } catch (error) {
      setProjectsError(error.message);
    } finally {
      setProjectBusy(false);
    }
  }

  async function handleDeleteProject(project) {
    if (!window.confirm(`Delete “${project.name}”? This also deletes its project data.`)) return;
    const token = getToken();
    if (!token) return;
    setProjectBusy(true);
    setProjectsError("");
    setProjectNotice("");
    try {
      await deleteProject(token, project.id);
      setSelectedProjectId(null);
      setProjectDetails(null);
      await refreshProjects(token);
      setProjectNotice("Project deleted.");
    } catch (error) {
      setProjectsError(error.message);
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
    const token = getToken();
    if (!token || !selectedProjectId) return;
    setProjectBusy(true);
    setProjectsError("");
    const editing = editingTaskId !== null;
    const data = {
      title: taskTitle,
      description: taskDescription.trim() || null,
      priority: taskPriority,
      status: taskStatus,
      due_at: taskDueAt ? new Date(taskDueAt).toISOString() : null,
      assignee_ids: taskAssigneeIds.map(Number),
    };
    try {
      await saveTask(token, selectedProjectId, editingTaskId, data);
      await refreshTasks(selectedProjectId, token);
      setTaskFormOpen(false);
      setProjectNotice(editing ? "Task updated." : "Task created.");
    } catch (error) {
      setProjectsError(error.message);
    } finally {
      setProjectBusy(false);
    }
  }

  async function handleTaskStatusChange(task, status) {
    const token = getToken();
    if (!token || !selectedProjectId) return;
    try {
      await saveTask(token, selectedProjectId, task.id, { status });
      await refreshTasks(selectedProjectId, token);
    } catch (error) {
      setProjectsError(error.message);
    }
  }

  async function handleDeleteTask(task) {
    if (!window.confirm(`Delete task “${task.title}”?`)) return;
    const token = getToken();
    if (!token || !selectedProjectId) return;
    try {
      await deleteTask(token, selectedProjectId, task.id);
      await refreshTasks(selectedProjectId, token);
      setProjectNotice("Task deleted.");
    } catch (error) {
      setProjectsError(error.message);
    }
  }

  async function handleAddProjectMember(event) {
    event.preventDefault();
    const token = getToken();
    if (!token || !selectedProjectId) return;
    setMemberBusy(true);
    setProjectsError("");
    try {
      await addProjectMember(token, selectedProjectId, memberEmail);
      setMemberEmail("");
      await refreshMembers(selectedProjectId, token);
      setProjectNotice("Project member added.");
    } catch (error) {
      setProjectsError(error.message);
    } finally {
      setMemberBusy(false);
    }
  }

  async function handleRemoveProjectMember(member) {
    if (!window.confirm(`Remove ${member.username} from this project? Their task assignments in this project will also be removed.`)) return;
    const token = getToken();
    if (!token || !selectedProjectId) return;
    setMemberBusy(true);
    setProjectsError("");
    try {
      await removeProjectMember(token, selectedProjectId, member.user_id);
      await Promise.all([
        refreshMembers(selectedProjectId, token),
        refreshTasks(selectedProjectId, token),
      ]);
      setProjectNotice(`${member.username} was removed from the project.`);
    } catch (error) {
      setProjectsError(error.message);
    } finally {
      setMemberBusy(false);
    }
  }

  function showProjects() {
    setSelectedProjectId(null);
    setProjectDetails(null);
    setProjectFormOpen(false);
    setTaskFormOpen(false);
    setProjectNotice("");
  }

  function openProject(project) {
    setProjectDetails(null);
    setSelectedProjectId(project.id);
    setProjectFormOpen(false);
    setTaskFormOpen(false);
    setProjectNotice("");
  }

  const selectedProject = projectDetails || projects.find((project) => project.id === selectedProjectId);
  const isOwner = selectedProject?.owner_id === user.id;

  return (
    <main className="workspace-shell">
      <WorkspaceSidebar user={user} onShowProjects={showProjects} />
      <section className="workspace-main">
        <header className="workspace-topbar">
          <div className="workspace-breadcrumb">
            Projects{selectedProject && <> <span>/</span> <strong>{selectedProject.name}</strong></>}
          </div>
          <button className="logout-button" onClick={onLogout}>Log out</button>
        </header>

        <div className="workspace-content">
          <div className="project-heading">
            <div>
              <div className="eyebrow">WORKSPACE</div>
              <h1>{selectedProject ? selectedProject.name : "My projects"}</h1>
              <p>{selectedProject?.description || (selectedProject ? "Project details" : "Projects you own or have been invited to.")}</p>
            </div>
            {selectedProject ? (
              <div className="project-workspace-actions">
                <button className="secondary-button" onClick={showProjects}>Back</button>
                {isOwner && (
                  <>
                    <button className="secondary-button" onClick={() => openEditProject(selectedProject)}>Edit project</button>
                    <button className="danger-button" onClick={() => handleDeleteProject(selectedProject)} disabled={projectBusy}>Delete</button>
                  </>
                )}
                <button className="primary-button new-task-button" onClick={openCreateTask}>+ <span>New task</span></button>
              </div>
            ) : (
              <button className="primary-button new-task-button" onClick={openCreateProject}>+ <span>New project</span></button>
            )}
          </div>

          {projectsError && <div className="notice error-notice project-notice" role="alert">{projectsError}</div>}
          {projectNotice && <div className="notice success-notice project-notice" role="status">{projectNotice}</div>}

          {projectFormOpen && (
            <ProjectEditor
              editing={editingProjectId !== null}
              name={projectName}
              description={projectDescription}
              onNameChange={setProjectName}
              onDescriptionChange={setProjectDescription}
              onSubmit={handleSaveProject}
              onCancel={() => setProjectFormOpen(false)}
              busy={projectBusy}
              project={editingProjectId !== null ? selectedProject : null}
              currentUserId={user.id}
              tasks={tasks}
              onCreateTask={openCreateTask}
              onEditTask={openEditTask}
              onDeleteTask={handleDeleteTask}
              members={projectMembers}
              memberEmail={memberEmail}
              onMemberEmailChange={setMemberEmail}
              onAddMember={handleAddProjectMember}
              onRemoveMember={handleRemoveProjectMember}
              memberBusy={memberBusy}
            />
          )}

          {selectedProject && taskFormOpen && (
            <TaskForm
              editing={editingTaskId !== null}
              title={taskTitle}
              description={taskDescription}
              priority={taskPriority}
              status={taskStatus}
              dueAt={taskDueAt}
              assigneeIds={taskAssigneeIds}
              members={projectMembers}
              busy={projectBusy}
              onTitleChange={setTaskTitle}
              onDescriptionChange={setTaskDescription}
              onPriorityChange={setTaskPriority}
              onStatusChange={setTaskStatus}
              onDueAtChange={setTaskDueAt}
              onAssigneeIdsChange={setTaskAssigneeIds}
              onSubmit={handleSaveTask}
              onCancel={() => setTaskFormOpen(false)}
            />
          )}

          {selectedProject ? (
            <>
              {tasksLoading ? (
                <div className="project-empty-state">Loading project tasks...</div>
              ) : (
                <TaskBoard
                  tasks={tasks}
                  members={projectMembers}
                  onAddTask={openCreateTask}
                  onEditTask={openEditTask}
                  onDeleteTask={handleDeleteTask}
                  onStatusChange={handleTaskStatusChange}
                />
              )}
              <ProjectMembers
                members={projectMembers}
                isOwner={isOwner}
                email={memberEmail}
                onEmailChange={setMemberEmail}
                onAdd={handleAddProjectMember}
                busy={memberBusy}
                onRemove={handleRemoveProjectMember}
              />
            </>
          ) : projectsLoading ? (
            <div className="project-empty-state">Loading your projects...</div>
          ) : projects.length ? (
            <ProjectList projects={projects} onOpen={openProject} />
          ) : (
            <div className="project-empty-state">
              <div className="empty-icon">+</div>
              <h2>No projects yet</h2>
              <p>Create your first project to get started.</p>
              <button className="primary-button" onClick={openCreateProject}>Create a project</button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
