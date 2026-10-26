import { config } from "../config.js";
const API_URL = config.API_URL;

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Generic request template.
export async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, options);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      `Server responded with ${response.status}`,
    );
  }

  if (options.method === "DELETE" || response.status === 204) {
    return { ok: true };
  }

  const apiResponse = await response.json();
  return apiResponse.data;
}

function headers(userId, hasJsonBody = false) {
  const result = { "X-User-ID": userId };
  if (hasJsonBody) result["Content-Type"] = "application/json";
  return result;
}

export async function readTasks(offset, limit, userId) {
  return await request(`/tasks?offset=${offset}&limit=${limit + 1}`, {
    headers: headers(userId),
  });
}

export async function updateTaskName(taskId, newName, userId) {
  return await request(`/tasks/${taskId}/name`, {
    method: "PATCH",
    headers: headers(userId, true),
    body: JSON.stringify({ task_name: newName }),
  });
}

export async function updateTaskCompletion(taskId, isDone, userId, signal) {
  return await request(`/tasks/${taskId}`, {
    method: "PATCH",
    headers: headers(userId, true),
    body: JSON.stringify({ is_done: isDone }),
    signal,
  });
}

export async function createTask(taskName, userId) {
  return await request(`/tasks`, {
    method: "POST",
    headers: headers(userId, true),
    body: JSON.stringify({ task_name: taskName }),
  });
}

export async function deleteTask(taskId, userId) {
  return await request(`/tasks/${taskId}`, {
    method: "DELETE",
    headers: headers(userId),
  });
}

export async function clearCompletedTasks(userId) {
  return await request(`/tasks/completed/`, {
    method: "DELETE",
    headers: headers(userId),
  });
}

export async function createUser(userId) {
  return await request(`/users/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
}
