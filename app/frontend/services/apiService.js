import { config } from "../config.js";
import { state } from "./stateService.js";
const API_URL = config.API_URL;

// Generic request template
export async function request(path, options) {
  try {
    const response = await fetch(`${API_URL}${path}`, options);
    if (!response.ok)
      throw new Error(`Server responded with ${response.status}`);

    if (options.method === "DELETE") return { ok: true };

    const apiResponse = await response.json();

    return apiResponse.data;
  } catch (error) {
    console.log("Error: ", error);
  }
}

export async function readTasks(offset, limit, userId) {
  return await request(`/tasks?offset=${offset}&limit=${limit + 1}`, {
    headers: {
      "X-User-ID": userId,
    },
  });
}

export async function updateTaskName(taskId, newName, userId) {
  return await request(`/tasks/${taskId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-User-ID": userId,
    },
    body: JSON.stringify({ task_name: newName }),
  });
}

export async function updateTaskCompletion(taskId, isDone, signal, userId) {
  const response = await request(`/tasks/${taskId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-User-ID": userId,
    },
    body: JSON.stringify({ is_done: isDone }),
    signal: signal,
  });

  return response;
}

export async function createTask(taskName, userId) {
  return await request(`/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-ID": userId,
    },
    body: JSON.stringify({ task_name: taskName }),
  });
}

export async function deleteTask(taskId, userId) {
  return await request(`/tasks/${taskId}`, {
    method: "DELETE",
    headers: {
      "X-User-ID": userId,
    },
  });
}

export async function clearCompletedTasks(userId) {
  return await request(`/tasks/completed/`, {
    method: "DELETE",
    headers: {
      "X-User-ID": userId,
    },
  });
}

export async function createUser(userId) {
  return await request(`/users/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: userId }),
  });
}
