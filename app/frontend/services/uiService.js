import { state } from "./stateService.js";
import { config } from "../config.js";
import * as apiService from "./apiService.js";

const EMPTY_MESSAGE = "Nothing here yet. Add your first task above.";

// ---------- DOM references ----------

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

// ---------- Notices & list messages ----------

let noticeTimer = null;
let loadFailed = false;

export function showListMessage(text, isError = false) {
  listMessage.textContent = text;
  listMessage.classList.toggle("task-list__message--error", isError);
  listMessage.hidden = false;
}

export function hideListMessage() {
  listMessage.hidden = true;
}

export function showNotice(text, isError = true) {
  clearTimeout(noticeTimer);
  notice.textContent = text;
  notice.classList.toggle("notice--info", !isError);
  notice.setAttribute("role", isError ? "alert" : "status");
  notice.hidden = false;

  noticeTimer = setTimeout(clearNotice, config.noticeTimeoutInMS);
}

export function clearNotice() {
  clearTimeout(noticeTimer);
  notice.hidden = true;
  notice.textContent = "";
}

// ---------- Rendering ----------

export function setTaskName(taskItem, name) {
  taskItem.dataset.taskName = name;
  taskItem.querySelector(".task__name").textContent = name;
  taskItem
    .querySelector(".task__delete")
    .setAttribute("aria-label", `Delete task: ${name}`);
  taskItem
    .querySelector(".task__edit")
    .setAttribute("aria-label", `Edit task: ${name}`);
}

export function createTaskElement(task) {
  const taskItem = taskTemplate.content.firstElementChild.cloneNode(true);

  taskItem.dataset.taskId = task.task_id;
  setTaskName(taskItem, task.task_name);
  taskItem.querySelector(".task__toggle").checked = Boolean(task.is_done);

  return taskItem;
}

function renderTasks(tasks) {
  state.hasNextPage = tasks.length > config.PAGE_LIMIT;
  state.hasPrevPage = state.currentOffset > 0;

  taskList.replaceChildren(
    ...tasks.slice(0, config.PAGE_LIMIT).map((task) => createTaskElement(task)),
  );
}

export function updateSummary() {
  const total = taskList.children.length;
  const done = taskList.querySelectorAll(".task__toggle:checked").length;

  if (total === 0) {
    summary.textContent = "";
    progressFill.style.width = "0%";
    if (!loadFailed) showListMessage(EMPTY_MESSAGE);
    return;
  }

  loadFailed = false;
  hideListMessage();

  const scope =
    state.currentOffset > 0 || state.hasNextPage ? " on this page" : "";

  summary.textContent =
    done === total
      ? `All ${total} done${scope}`
      : `${done} of ${total} done${scope}`;
  progressFill.style.width = `${(done / total) * 100}%`;
}

export function updatePager() {
  state.hasPrevPage = state.currentOffset > 0;
  pager.hidden = !state.hasPrevPage && !state.hasNextPage;

  pagerStatus.textContent = `Page ${state.currentOffset / config.PAGE_LIMIT + 1}`;
  prevButton.disabled = state.isLoading || !state.hasPrevPage;
  nextButton.disabled = state.isLoading || !state.hasNextPage;
}

function displayLoadPageError() {
  if (taskList.children.length === 0) {
    loadFailed = true;
    showListMessage(
      "Couldn't load your tasks. Make sure the API is running, then refresh.",
      true,
    );
  } else {
    showNotice("Couldn't load that page. Try again.");
  }
}

// ---------- Loading & pagination ----------

let loadSeq = 0;

export async function loadPage(offset) {
  const seq = ++loadSeq;
  const previousOffset = state.currentOffset;

  state.isLoading = true;
  state.currentOffset = offset;
  loadFailed = false;
  updatePager();

  if (taskList.children.length === 0) showListMessage("Loading your tasks…");

  try {
    const tasks = await apiService.readTasks(
      offset,
      config.PAGE_LIMIT,
      state.local_id,
    );

    if (seq !== loadSeq) return false;

    if (tasks.length === 0 && offset > 0) {
      return await loadPage(Math.max(0, offset - config.PAGE_LIMIT));
    }

    renderTasks(tasks);
    return true;
  } catch (error) {
    if (seq !== loadSeq) return false;

    console.error("Failed to load tasks:", error);
    state.currentOffset = previousOffset;
    displayLoadPageError();
    return false;
  } finally {
    if (seq === loadSeq) {
      state.isLoading = false;
      updatePager();
      updateSummary();
    }
  }
}

export function refreshPage() {
  return loadPage(state.currentOffset);
}

export function scrollToTasksTop() {
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  tasksPanel.scrollIntoView({
    behavior: prefersReducedMotion ? "auto" : "smooth",
    block: "start",
  });
  tasksTitle.focus({ preventScroll: true });
}

export async function goToPage(offset) {
  clearNotice();
  const loaded = await loadPage(offset);
  if (loaded) scrollToTasksTop();
}

export const goToPreviousPage = () =>
  goToPage(Math.max(0, state.currentOffset - config.PAGE_LIMIT));

export const goToNextPage = () =>
  goToPage(state.currentOffset + config.PAGE_LIMIT);

// ---------- Optimistic helpers ----------

export function isDuplicateName(name, exceptItem = null) {
  return Array.from(taskList.children).some(
    (item) => item !== exceptItem && item.dataset.taskName === name,
  );
}

let tempIdCounter = 0;

export function optimisticCreateTask() {
  clearNotice();

  const newTaskName = taskInput.value.trim();
  if (!newTaskName) return null;

  if (isDuplicateName(newTaskName)) {
    showNotice("Task with this name already exists.", true);
    return null;
  }

  const tempTask = createTaskElement({
    task_id: -++tempIdCounter,
    task_name: newTaskName,
    is_done: false,
  });
  tempTask.classList.add("task--temp");

  if (!state.hasNextPage && taskList.children.length < config.PAGE_LIMIT) {
    taskList.appendChild(tempTask);
  } else {
    showNotice("Task added. It's on a later page.", false);
  }

  submitButton.disabled = true;
  taskInput.value = "";

  return tempTask;
}
export function removeTaskElement(taskItem) {
  taskItem.classList.add("task--removing");
  return new Promise((resolve) => {
    setTimeout(() => {
      taskItem.remove();
      resolve();
    }, 160);
  });
}

export function restoreTaskElement(taskItem, nextSibling) {
  const reference =
    nextSibling && nextSibling.parentNode === taskList ? nextSibling : null;
  taskItem.classList.remove("task--removing");
  taskList.insertBefore(taskItem, reference);
}

export function optimisticRemoveCompleted() {
  state.pendingTaskDeletions.length = 0;

  Array.from(taskList.children).forEach((element, index) => {
    if (element.querySelector(".task__toggle").checked) {
      state.pendingTaskDeletions.push({ element, index });
      element.remove();
    }
  });
}

export function restorePendingTaskDeletions() {
  state.pendingTaskDeletions.forEach(({ element, index }) => {
    taskList.insertBefore(element, taskList.children[index] ?? null);
  });
  state.pendingTaskDeletions.length = 0;
}

// ---------- Edit popup ----------

export function createTaskEditPopup(currentName = "") {
  const container = document.createElement("div");
  container.classList.add("task__edit-popup");
  container.setAttribute("role", "dialog");
  container.setAttribute("aria-modal", "true");
  container.setAttribute("aria-labelledby", "task-edit-title");

  const prompt = document.createElement("h2");
  prompt.id = "task-edit-title";
  prompt.textContent = "Enter a new task name";
  container.appendChild(prompt);

  const editForm = document.createElement("form");
  editForm.classList.add("task__edit-popup-form");
  container.appendChild(editForm);

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "New task name";
  input.maxLength = 120;
  input.required = true;
  input.value = currentName;
  editForm.appendChild(input);

  const saveButton = document.createElement("button");
  saveButton.type = "submit";
  saveButton.textContent = "Save";
  editForm.appendChild(saveButton);

  const cancelButton = document.createElement("button");
  cancelButton.classList.add("task__edit-popup__cancel");
  cancelButton.type = "button";
  cancelButton.setAttribute("aria-label", "Cancel");
  cancelButton.innerHTML = "&#10006;";
  container.appendChild(cancelButton);

  return container;
}

export function showTaskEditPopup(event) {
  const editButton = event.target.closest(".task__edit");
  if (!editButton || state.isTaskEditPopupActive) return;

  const taskItem = editButton.closest(".task");

  if (taskItem.classList.contains("task--temp")) {
    showNotice("Task is still being created. Please wait.", true);
    return;
  }

  document.querySelector("main").classList.add("blur");

  const popup = createTaskEditPopup(taskItem.dataset.taskName);
  document.body.appendChild(popup);

  const input = popup.querySelector("input");
  input.focus();
  input.select();

  state.selectedTask = taskItem;
  state.isTaskEditPopupActive = true;
}

export function closeTaskEditPopup() {
  const popup = document.querySelector(".task__edit-popup");
  if (popup) {
    popup.remove();
    document.querySelector("main").classList.remove("blur");
    state.selectedTask?.querySelector(".task__edit")?.focus();
  }
  state.isTaskEditPopupActive = false;
}
