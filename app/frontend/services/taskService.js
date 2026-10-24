import { config } from "../config.js";
import * as apiService from "./apiService.js";
import * as uiService from "./uiService.js";
import { state } from "./stateService.js";

// ---------- Mutation tracking ----------

let pendingMutations = 0;
let needsRefresh = false;

function beginMutation() {
  pendingMutations++;
}

async function endMutation({ refresh = false } = {}) {
  pendingMutations--;
  needsRefresh ||= refresh;

  if (pendingMutations === 0 && needsRefresh) {
    needsRefresh = false;
    await uiService.refreshPage();
  }
}

// ---------- Create ----------

export async function createTaskEvent(event) {
  event.preventDefault();

  const tempTask = uiService.optimisticCreateTask();
  if (!tempTask) return;

  uiService.updateSummary();

  setTimeout(() => {
    uiService.submitButton.disabled = false;
    uiService.taskInput.focus();
  }, config.submitCooldownTimeInMs);

  const taskName = tempTask.dataset.taskName;

  beginMutation();
  try {
    const response = await apiService.createTask(taskName, state.local_id);

    tempTask.dataset.taskId = response.task_id;
    tempTask.classList.remove("task--temp");
  } catch (error) {
    tempTask.remove();

    if (!uiService.taskInput.value) uiService.taskInput.value = taskName;

    uiService.showNotice(
      error.status === 409
        ? "Task with this name already exists."
        : "Couldn't add that task. Check that the API is running and try again.",
    );
    uiService.updateSummary();
  } finally {
    await endMutation({ refresh: true });
  }
}

// ---------- Update completion ----------

const activeToggles = new Set();

async function syncCompletion(taskId, checkbox, confirmed) {
  beginMutation();
  try {
    let desired = checkbox.checked;

    while (true) {
      let response;
      try {
        response = await apiService.updateTaskCompletion(
          taskId,
          desired,
          state.local_id,
        );
      } catch (error) {
        checkbox.checked = confirmed;
        uiService.showNotice("Couldn't update that task. Try again.");
        return;
      }

      confirmed = response?.is_done ?? desired;
      const userChangedAgain = checkbox.checked !== desired;

      if (!userChangedAgain) {
        checkbox.checked = confirmed;
        return;
      }

      desired = checkbox.checked;
    }
  } finally {
    activeToggles.delete(taskId);
    uiService.updateSummary();
    await endMutation();
  }
}

export async function updateTaskCompletionEvent(event) {
  const checkbox = event.target.closest(".task__toggle");
  if (!checkbox) return;

  const taskItem = checkbox.closest(".task");

  if (taskItem.classList.contains("task--temp")) {
    checkbox.checked = !checkbox.checked;
    uiService.showNotice("Task is still being created. Please wait.", true);
    return;
  }

  uiService.updateSummary();

  const taskId = taskItem.dataset.taskId;
  if (activeToggles.has(taskId)) return;

  activeToggles.add(taskId);
  await syncCompletion(taskId, checkbox, !checkbox.checked);
}

// ---------- Update name ----------

export async function updateTaskNameEvent(event) {
  const editForm = event.target.closest(".task__edit-popup-form");
  if (!editForm || !state.isTaskEditPopupActive) return;

  event.preventDefault();

  const taskItem = state.selectedTask;
  const currentName = taskItem.dataset.taskName;
  const newName = editForm.querySelector("input").value.trim();

  if (!newName) return;
  if (newName === currentName) {
    uiService.closeTaskEditPopup();
    return;
  }
  if (uiService.isDuplicateName(newName, taskItem)) {
    uiService.showNotice("Task with this name already exists.", true);
    return;
  }

  uiService.closeTaskEditPopup();
  uiService.setTaskName(taskItem, newName);

  beginMutation();
  try {
    await apiService.updateTaskName(
      taskItem.dataset.taskId,
      newName,
      state.local_id,
    );
    uiService.showNotice("Task name updated successfully.", false);
  } catch (error) {
    uiService.setTaskName(taskItem, currentName);
    uiService.showNotice(
      error.status === 409
        ? "Task with this name already exists."
        : "Couldn't update the task name. Try again.",
    );
  } finally {
    await endMutation({ refresh: true });
  }
}

// ---------- Delete ----------

export async function deleteTaskEvent(event) {
  const deleteButton = event.target.closest(".task__delete");
  if (!deleteButton) return;

  const taskItem = deleteButton.closest(".task");

  if (taskItem.classList.contains("task--temp")) {
    uiService.showNotice("Task is still being created. Please wait.", true);
    return;
  }

  uiService.clearNotice();
  deleteButton.disabled = true;

  const nextSibling = taskItem.nextElementSibling;

  const removal = uiService
    .removeTaskElement(taskItem)
    .then(() => uiService.updateSummary());

  beginMutation();
  try {
    await apiService.deleteTask(taskItem.dataset.taskId, state.local_id);
  } catch (error) {
    // DELETE is idempotent: a 404 means it's already gone, which is success.
    if (error.status !== 404) {
      await removal; // make sure it's detached before re-inserting
      uiService.restoreTaskElement(taskItem, nextSibling);
      deleteButton.disabled = false;
      uiService.showNotice("Couldn't delete that task. Try again.");
      uiService.updateSummary();
    }
  } finally {
    await endMutation({ refresh: true });
  }
}

// ---------- Clear completed ----------

export async function clearCompletedTasksEvent(event) {
  // event.preventDefault();

  const button = uiService.clearCompletedButton;
  if (button.disabled) return;
  button.disabled = true;

  uiService.optimisticRemoveCompleted();
  uiService.updateSummary();

  beginMutation();
  try {
    await apiService.clearCompletedTasks(state.local_id);
    state.pendingTaskDeletions.length = 0;
  } catch (error) {
    uiService.restorePendingTaskDeletions();
    uiService.showNotice("Couldn't clear completed tasks. Try again.");
    uiService.updateSummary();
  } finally {
    button.disabled = false;
    // server cleared completed tasks on ALL pages, so re-sync this page
    await endMutation({ refresh: true });
  }
}
