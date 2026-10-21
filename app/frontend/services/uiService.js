import { state } from "./stateService.js";
import { config } from "../config.js";
import * as apiService from "./apiService.js";

export const taskInput = document.querySelector(".composer__input");
export const submitButton = document.querySelector(".composer__submit");

export const tasksPanel = document.querySelector(".tasks");
export const tasksTitle = document.querySelector(".tasks__title");
export const taskList = document.querySelector(".task-list");
export const taskTemplate = document.querySelector("#task-template");

export const listMessage = document.querySelector(".task-list__message");
export const notice = document.querySelector(".notice");

export const summary = document.querySelector(".tasks__summary");
export const progressFill = document.querySelector(".progress__fill");
export const form = document.querySelector(".composer");

export const pager = document.querySelector(".pager");
export const prevButton = document.querySelector(".pager__prev");
export const nextButton = document.querySelector(".pager__next");
export const pagerStatus = document.querySelector(".pager__status");

export const clearCompletedButton = document.querySelector(".tasks__clear");

export function createTaskElement(task) {
  const taskItem = taskTemplate.content.firstElementChild.cloneNode(true);

  taskItem.dataset.taskId = task.task_id;
  taskItem.dataset.taskName = task.task_name;

  taskItem.querySelector(".task__name").textContent = task.task_name;
  taskItem.querySelector(".task__toggle").checked = task.is_done;
  taskItem
    .querySelector(".task__delete")
    .setAttribute("aria-label", `Delete task: ${task.task_name}`);
  taskItem
    .querySelector(".task__edit")
    .setAttribute("aria-label", `Edit task: ${task.task_name}`);

  return taskItem;
}

export async function loadPage(offset) {
  state.isLoading = true;
  updatePager();

  try {
    const tasks = await apiService.readTasks(
      offset,
      config.PAGE_LIMIT + 1,
      state.local_id,
    );

    if (tasks.length === 0 && offset > 0) {
      return await loadPage(Math.max(0, offset - config.PAGE_LIMIT));
    }

    mapTasksToUI(tasks, offset, config.PAGE_LIMIT, createTaskElement);
    updateSummary();

    if (tasks.length === 0) {
      showListMessage("Nothing here yet. Add your first task above.");
    } else {
      hideListMessage();
    }

    return true;
  } catch (error) {
    console.log("Error: ", error);

    displayLoadPageError();

    return false;
  } finally {
    state.isLoading = false;
    updatePager();
    updateSummary();
  }
}

export function showListMessage(text, isError = false) {
  listMessage.textContent = text;
  listMessage.classList.toggle("task-list__message--error", isError);
  listMessage.hidden = false;
}

export function hideListMessage() {
  listMessage.hidden = true;
}

export function showNotice(text, isError = true) {
  notice.textContent = text;
  notice.classList.toggle("notice--info", !isError);
  notice.setAttribute("role", isError ? "alert" : "status");
  notice.hidden = false;

  setTimeout(() => {
    clearNotice();
  }, config.noticeTimeoutInMS);
}

export function clearNotice() {
  notice.hidden = true;
  notice.textContent = "";
}

export function updateSummary() {
  const total = taskList.children.length;
  const done = taskList.querySelectorAll(".task__toggle:checked").length;

  progressFill.style.width = "0%";

  if (total === 0) {
    summary.textContent = "";
    showListMessage("Nothing here yet. Add your first task above.");
    return;
  }

  summary.textContent =
    done === total ? `All ${total} done` : `${done} of ${total} done`;
  progressFill.style.width = `${(done / total) * 100}%`;
}

export async function mapTasksToUI(tasks, offset, pageLimit, createFn) {
  if (tasks.length === 0 && offset > 0) {
    return await apTasksToUI(
      [],
      Math.max(0, offset - pageLimit),
      pageLimit,
      createFn,
    );
  } else if (tasks.length === 0 && offset === 0) {
    showListMessage("Nothing here yet. Add your first task above.");
  }

  taskList.replaceChildren(...tasks.slice(0, pageLimit).map(createFn));
}

export function updatePager() {
  let hasPrevPage = state.currentOffset > 0;

  pager.hidden =
    !hasPrevPage &&
    !(typeof state.hasNextPage !== "undefined" && state.hasNextPage);

  pagerStatus.textContent = `Page ${state.currentOffset / config.pageLimit + 1}`;
  prevButton.disabled = state.isLoading || !state.hasPrevPage;
  nextButton.disabled =
    state.isLoading ||
    !(typeof state.hasNextPage !== "undefined" && state.hasNextPage);
  config.pageLimit = config.pageLimit;
}

export function optimisticRemoveTasks(taskList) {
  for (let i = 0; i < taskList.children.length; i++) {
    let currentElement = taskList.children[i];

    if (currentElement.querySelector(".task__toggle").checked) {
      taskList.removeChild(currentElement);
      state.pendingTaskDeletions.push(currentElement);
      i--;
    }

    console.log(
      `pending task deletions in state: ${state.pendingTaskDeletions}`,
    );
  }
}

export function restorePendingTaskDeletions() {
  state.pendingTaskDeletions.forEach((element) => {
    taskList.appendChild(element);
  });
}

export function createTaskEditPopup() {
  const TaskEditContainer = document.createElement("div");
  TaskEditContainer.classList.add("task__edit-popup");

  const TaskEditPrompt = document.createElement("h2");
  TaskEditPrompt.textContent = "Enter a new task name";
  TaskEditContainer.appendChild(TaskEditPrompt);

  const TaskEditForm = document.createElement("form");
  TaskEditForm.classList.add("task__edit-popup-form");
  TaskEditContainer.appendChild(TaskEditForm);

  const TaskEditInput = document.createElement("input");
  TaskEditInput.type = "text";
  TaskEditInput.placeholder = "New task name";
  TaskEditInput.maxLength = 120;
  TaskEditInput.required = true;
  TaskEditInput.autofocus = true;
  TaskEditForm.appendChild(TaskEditInput);

  const TaskEditSubmit = document.createElement("button");
  TaskEditSubmit.type = "submit";
  TaskEditSubmit.textContent = "Save";
  TaskEditForm.appendChild(TaskEditSubmit);

  const TaskEditCancel = document.createElement("button");
  TaskEditCancel.classList.add("task__edit-popup__cancel");
  TaskEditCancel.type = "button";
  TaskEditCancel.innerHTML = "&#10006;";
  TaskEditContainer.appendChild(TaskEditCancel);

  return TaskEditContainer;
}

export function checkPrefersReducedMotion() {
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  tasksPanel.scrollIntoView({
    behavior: prefersReducedMotion ? "auto" : "smooth",
    block: "start",
  });
  tasksTitle.focus({ preventScroll: true });
}

export function displayLoadPageError() {
  if (taskList.children.length === 0) {
    showListMessage(
      "Couldn't load your tasks. Make sure the API is running, then refresh.",
      true,
    );
  } else {
    showNotice("Couldn't load that page. Try again.");
    updateSummary();
  }
}

// Moves to another page, then brings the top of the list back into view
async function goToPage(offset) {
  clearNotice();

  const loaded = await loadPage(offset);
  if (!loaded) return;
}

checkPrefersReducedMotion();

prevButton.addEventListener("click", () =>
  goToPage(Math.max(0, state.currentOffset - PAGE_LIMIT)),
);
nextButton.addEventListener("click", () =>
  goToPage(state.currentOffset + PAGE_LIMIT),
);

export async function showTaskEditPopup(event) {
  const editButton = event.target.closest(".task__edit");
  if (!editButton) return;

  document.querySelector("main").classList.add("blur");

  const taskItem = editButton.closest(".task");
  const taskEditContainer = createTaskEditPopup(taskItem);
  document.body.appendChild(taskEditContainer);

  taskEditContainer.querySelector("input").focus();
  state.selectedTask = taskItem;
}

export async function closeTaskEditPopup() {
  const taskEditPopup = document.querySelector(".task__edit-popup");
  if (taskEditPopup) {
    taskEditPopup.remove();
    document.querySelector("main").classList.remove("blur");
  }
}

function checkForDuplicateTask(newTaskName) {
  return Array.from(taskList.children).some(
    (task) => task.querySelector(".task__name").textContent === newTaskName,
  );
}

let tempIdCounter = 0;
export async function optimisticCreateTask() {
  const newTaskName = taskInput.value.trim();
  if (!newTaskName) return;

  if (checkForDuplicateTask(newTaskName)) {
    showNotice("Task with this name already exists.", true);
    return;
  }

  let tempTask = createTaskElement({
    task_name: newTaskName,
    isDone: false,
    task_id: -++tempIdCounter,
  });

  tempTask.classList.add("task--temp");

  if (!state.hasNextPage && taskList.children.length < config.PAGE_LIMIT) {
    taskList.appendChild(tempTask);
  } else if (taskList.children.length >= config.PAGE_LIMIT) {
    showNotice("Task added. It's on a later page.", false);

    updatePager();
  }

  submitButton.disabled = true;
  taskInput.value = "";

  return tempTask;
}

export async function optimisticUpdateTaskCompletion(event) {
  const taskItem = event.target.closest(".task");

  if (taskItem.classList.contains("task--temp")) {
    showNotice("Task is still being created. Please wait.", true);
    return;
  }

  if (!event.target.classList.contains("task__toggle")) return;

  state.currentController = new AbortController();
  const { signal } = state.currentController;

  event.target.disabled = true;
  setTimeout(() => {
    event.target.disabled = false;
  }, config.completeTaskCooldownTimeInMs);

  const checkbox = event.target;
  let checkedState = checkbox.checked;

  let taskId = checkbox.closest(".task").dataset.taskId;

  updateSummary();

  return {
    taskId,
    checkedState,
    signal,
    checkbox,
    taskItem,
  };
}

export function checkAborted(error, taskItem) {
  if (error.name === "AbortError") {
    console.log("Request aborted");
    taskItem.classList.remove("task--updating");
    return;
  }
}
