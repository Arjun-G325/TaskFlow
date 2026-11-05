import { apiRequest } from "./client";

export function listProjects(token) {
  return apiRequest("/projects", { token });
}

export function getProject(token, projectId) {
  return apiRequest(`/projects/${projectId}`, { token });
}

export function saveProject(token, projectId, data) {
  return apiRequest(projectId ? `/projects/${projectId}` : "/projects", {
    method: projectId ? "PUT" : "POST",
    token,
    body: JSON.stringify(data),
  });
}

export function deleteProject(token, projectId) {
  return apiRequest(`/projects/${projectId}`, { method: "DELETE", token });
}

export function listTasks(token, projectId) {
  return apiRequest(`/projects/${projectId}/tasks`, { token });
}

export function saveTask(token, projectId, taskId, data) {
  return apiRequest(taskId
    ? `/projects/${projectId}/tasks/${taskId}`
    : `/projects/${projectId}/tasks`, {
    method: taskId ? "PUT" : "POST",
    token,
    body: JSON.stringify(data),
  });
}

export function deleteTask(token, projectId, taskId) {
  return apiRequest(`/projects/${projectId}/tasks/${taskId}`, { method: "DELETE", token });
}

export function listProjectMembers(token, projectId) {
  return apiRequest(`/projects/${projectId}/members`, { token });
}

export function addProjectMember(token, projectId, email) {
  return apiRequest(`/projects/${projectId}/members`, {
    method: "POST",
    token,
    body: JSON.stringify({ email }),
  });
}

export function removeProjectMember(token, projectId, userId) {
  return apiRequest(`/projects/${projectId}/members/${userId}`, { method: "DELETE", token });
}
