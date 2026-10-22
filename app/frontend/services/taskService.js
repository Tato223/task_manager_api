import { config } from "../config.js";
import * as apiService from "./apiService.js";
import * as uiService from "./uiService.js";
import { state } from "./stateService.js";

export async function createTaskEvent(event) {
  event.preventDefault();

  let tempTask = await uiService.optimisticCreateTask();
  uiService.clearNotice();
  uiService.hideListMessage();

  setTimeout(() => {
    ((uiService.submitButton.disabled = false), uiService.taskInput.focus());
  }, config.submitCooldownTimeInMs);

  uiService.updateSummary();
  uiService.updatePager();

  try {
    const response = await apiService.createTask(
      tempTask.dataset.taskName,
      state.local_id,
    );

    tempTask.dataset.taskId = response.task_id;
    tempTask.classList.remove("task--temp");
  } catch (error) {
    uiService.showNotice(
      "Couldn't add that task. Check that the API is running and try again.",
    );
    tempTask.remove();
    uiService.updateSummary();
  } finally {
    uiService.submitButton.disabled = false;
    uiService.taskInput.focus();
    uiService.loadPage(state.currentOffset);
  }
}

export async function updateTaskCompletionEvent(event) {
  const { taskId, checkedState, signal, checkbox, taskItem } =
    await uiService.optimisticUpdateTaskCompletion(event);

  if (taskId === state.currentUpdateTaskId) {
    state.currentController.abort("Request aborted due to new change");
  }

  state.currentUpdateTaskId = taskId;

  try {
    const response = await apiService.updateTaskCompletion(
      taskId,
      checkedState,
      signal,
      state.local_id,
    );

    if (response) {
      checkbox.checked = await response.is_done;
    }

    uiService.updateSummary();
  } catch (error) {
    uiService.checkAborted(error, taskItem);

    checkbox.checked !== checkedState
      ? (checkbox.checked = checkedState)
      : null;

    uiService.showNotice("Couldn't update that task. Try again.");
  } finally {
    state.currentController = null;
  }
}

export async function updateTaskNameEvent(event) {
  if (!event.target.closest(".task__edit-popup-form")) return;
  if (!state.isTaskEditPopupActive) return;

  event.preventDefault();

  const taskEditPopup = event.target.closest(".task__edit-popup-form");
  const taskItem = state.selectedTask;
  const currentName = taskItem.querySelector(".task__name").textContent;
  const newName = taskEditPopup.querySelector("input").value?.trim();

  const updateTaskNamePromise = apiService.updateTaskName(
    taskItem.dataset.taskId,
    newName,
    state.local_id,
  );

  taskItem.querySelector(".task__name").textContent = newName;

  try {
    await updateTaskNamePromise;
    uiService.showNotice("Task name updated successfully.", false);
  } catch (error) {
    uiService.showNotice("Couldn't update the task name. Try again.");
    taskItem.querySelector(".task__name").textContent = currentName;
  } finally {
    uiService.closeTaskEditPopup();
    state.isTaskEditPopupActive = false;
  }
}

export async function deleteTaskEvent(event) {
  const deleteButton = event.target.closest(".task__delete");
  if (!deleteButton) return;

  const taskItem = deleteButton.closest(".task");

  uiService.clearNotice();
  uiService.hideListMessage();

  deleteButton.disabled = true;

  setTimeout(() => {
    uiService.taskList.removeChild(taskItem);
  }, 160);
  uiService.updateSummary();
  uiService.loadPage();
  uiService.navigateToPageIfTasksAreEmpty();

  if (uiService.taskList.children.length === 0) {
    uiService.showListMessage("Nothing here yet. Add your first task above.");
  }

  try {
    await apiService.deleteTask(taskItem.dataset.taskId, state.local_id);
    taskItem.classList.add("task--removing");
  } catch (error) {
    deleteButton.disabled = false;
    uiService.showNotice("Couldn't delete that task. Try again.");
  }
}

export async function clearCompletedTasksEvent(event) {
  event.preventDefault();

  try {
    const loaderElement = document.createElement("span", {
      class: "loader",
      parent: uiService.clearCompletedButton,
    });

    uiService.optimisticRemoveTasks(uiService.taskList);

    // uiService.clearCompletedButton.appendChild(loaderElement);
    uiService.updateSummary();

    const response = await apiService.clearCompletedTasks(state.local_id);

    // loaderElement.remove();
    // uiService.loadPage(state.currentOffset);

    uiService.updateSummary();

    if (!response.ok)
      throw new Error(`Server responded with ${response.status}`);
  } catch (error) {
    uiService.showNotice("Couldn't clear completed tasks. Try again.");
    uiService.restorePendingTaskDeletions();
  } finally {
    state.pendingTaskDeletions.length = 0;
    uiService.navigateToPageIfTasksAreEmpty();
  }
}
