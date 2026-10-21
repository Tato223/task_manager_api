import { config } from "./config.js";
import * as apiService from "./services/apiService.js";
import * as uiService from "./services/uiService.js";
import { state } from "./services/stateService.js";

// ---------- User ID Generation ----------

function generateUserID() {
  const id = new Uint32Array(1);
  crypto.getRandomValues(id);
  return id[0].toString(36);
}

if (!localStorage.getItem("user_id")) {
  localStorage.setItem("user_id", generateUserID());
  apiService.createUser(localStorage.getItem("user_id"));
  state.local_id = localStorage.getItem("user_id");
}

state.local_id = localStorage.getItem("user_id");

let isTaskEditPopupActive = false;

const isPaginated = state.currentOffset > 0 || state.hasNextPage;
const scope = isPaginated ? " on this page" : "";

// ---------- API calls ----------

uiService.loadPage(state.currentOffset);

// Create a new task when user presses submit button
uiService.form.addEventListener("submit", async (event) => {
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
    console.log("Error: ", error);
    uiService.showNotice(
      "Couldn't add that task. Check that the API is running and try again.",
    );
    console.log(error);
    tempTask.remove();
    uiService.updateSummary();
  } finally {
    uiService.submitButton.disabled = false;
    uiService.taskInput.focus();
  }
});

// Update Task Completed Status
uiService.taskList.addEventListener("change", async (event) => {
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
    console.log("Error: ", error);

    checkbox.checked !== checkedState
      ? (checkbox.checked = checkedState)
      : null;

    uiService.showNotice("Couldn't update that task. Try again.");
  } finally {
    state.currentController = null;
  }
});

// Clear all completed tasks
uiService.clearCompletedButton.addEventListener("click", async (event) => {
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
    console.log("Error: ", error);
    uiService.showNotice("Couldn't clear completed tasks. Try again.");
    uiService.restorePendingTaskDeletions();
  } finally {
    state.pendingTaskDeletions.length = 0;
  }
});

// open Edit Task popup
uiService.taskList.addEventListener("click", async (event) => {
  uiService.showTaskEditPopup(event);
  isTaskEditPopupActive = true;
});

// Change task name
document.body.addEventListener("submit", async (event) => {
  if (!event.target.closest(".task__edit-popup-form")) return;
  if (!isTaskEditPopupActive) return;

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

  console.log(state.local_id);

  try {
    await updateTaskNamePromise;
    taskItem.querySelector(".task__name").textContent = newName;
    uiService.showNotice("Task name updated successfully.", false);
  } catch (error) {
    console.log("Error: ", error);
    uiService.showNotice("Couldn't update the task name. Try again.");
    taskItem.querySelector(".task__name").textContent = currentName;
  } finally {
    uiService.closeTaskEditPopup();
    isTaskEditPopupActive = false;
  }
});

//close task edit popup
document.body.addEventListener("click", (event) => {
  if (!event.target.closest(".task__edit-popup__cancel")) return;

  uiService.closeTaskEditPopup();
  isTaskEditPopupActive = false;
});

// Delete a task
uiService.taskList.addEventListener("click", async (event) => {
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

  if (uiService.taskList.children.length === 0) {
    uiService.showListMessage("Nothing here yet. Add your first task above.");
  }

  try {
    await apiService.deleteTask(taskItem.dataset.taskId, state.local_id);
    taskItem.classList.add("task--removing");
  } catch (error) {
    console.log("Error: ", error);
    deleteButton.disabled = false;
    uiService.showNotice("Couldn't delete that task. Try again.");
  }
});
