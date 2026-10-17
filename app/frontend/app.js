import { config } from "./config.js";
const API_URL = config.API_URL;

// ---------- User ID Generation ----------

function generateUserID() {
  const id = new Uint32Array(1);
  crypto.getRandomValues(id);
  return id[0].toString(36);
}

if (!localStorage.getItem("user_id")) {
  localStorage.setItem("user_id", generateUserID());

  try {
    const response = await fetch(`${API_URL}/users/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: localStorage.getItem("user_id") }),
    });

    console.log(response);
  } catch (error) {
    console.error("Error creating user:", error);
  }
}

// ---------- DOM Values ----------

const local_id = localStorage.getItem("user_id");
const PAGE_LIMIT = 10;

const taskInput = document.querySelector(".composer__input");
const submitButton = document.querySelector(".composer__submit");

const tasksPanel = document.querySelector(".tasks");
const tasksTitle = document.querySelector(".tasks__title");
const taskList = document.querySelector(".task-list");
const taskTemplate = document.querySelector("#task-template");

const listMessage = document.querySelector(".task-list__message");
const notice = document.querySelector(".notice");

const summary = document.querySelector(".tasks__summary");
const progressFill = document.querySelector(".progress__fill");
const form = document.querySelector(".composer");

const pager = document.querySelector(".pager");
const prevButton = document.querySelector(".pager__prev");
const nextButton = document.querySelector(".pager__next");
const pagerStatus = document.querySelector(".pager__status");

const clearCompletedButton = document.querySelector(".tasks__clear");

let currentOffset = 0;
let hasNextPage = false;
let isLoading = false;
let tempIdCounter = 0;

const submitCooldownTimeInMs = 200;
const completeTaskCooldownTimeInMs = 500;

// ---------- Display helpers ----------\

function checkForDuplicateTask(newTaskName) {
  return Array.from(taskList.children).some(
    (task) => task.querySelector(".task__name").textContent === newTaskName,
  );
}

function createTaskElement(task) {
  const taskItem = taskTemplate.content.firstElementChild.cloneNode(true);

  taskItem.dataset.taskId = task.task_id;

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

function showListMessage(text, isError = false) {
  listMessage.textContent = text;
  listMessage.classList.toggle("task-list__message--error", isError);
  listMessage.hidden = false;
}

function showNotice(text, isError = true) {
  notice.textContent = text;
  notice.classList.toggle("notice--info", !isError);
  notice.setAttribute("role", isError ? "alert" : "status");
  notice.hidden = false;
}

function clearNotice() {
  notice.hidden = true;
}

function updateSummary() {
  const total = taskList.children.length;
  const done = taskList.querySelectorAll(".task__toggle:checked").length;

  if (total === 0) {
    summary.textContent = "";
    progressFill.style.width = "0%";
    showListMessage("Nothing here yet. Add your first task above.");
    return;
  }

  const isPaginated = currentOffset > 0 || hasNextPage;
  const scope = isPaginated ? " on this page" : "";

  listMessage.hidden = true;
  summary.textContent =
    done === total
      ? `All ${total} done${scope}`
      : `${done} of ${total} done${scope}`;
  progressFill.style.width = `${(done / total) * 100}%`;
}

function updatePager() {
  const hasPrevPage = currentOffset > 0;

  pager.hidden = !hasPrevPage && !hasNextPage;
  pagerStatus.textContent = `Page ${currentOffset / PAGE_LIMIT + 1}`;
  prevButton.disabled = isLoading || !hasPrevPage;
  nextButton.disabled = isLoading || !hasNextPage;
}

function optimisticRemoveTasks() {
  let pendingTaskDeletions = [];

  for (let i = 0; i < taskList.children.length; i++) {
    let currentElement = taskList.children[i];

    if (currentElement.querySelector(".task__toggle").checked) {
      taskList.removeChild(currentElement);
      pendingTaskDeletions.push(currentElement);
      i--;
    }
  }

  return pendingTaskDeletions;
}

function restorePendingTaskDeletions(pendingTaskDeletions) {
  pendingTaskDeletions.forEach((element) => {
    taskList.appendChild(element);
  });
}

function createTaskEditPopup() {
  const TaskEditContainer = document.createElement("div");
  TaskEditContainer.classList.add("task__edit-popup");

  const TaskEditPrompt = document.createElement("h2");
  TaskEditPrompt.textContent = "Enter a new task name";
  TaskEditContainer.appendChild(TaskEditPrompt);

  const TaskEditForm = document.createElement("form");
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
  TaskEditCancel.textContent = "x";
  TaskEditContainer.appendChild(TaskEditCancel);

  return TaskEditContainer;
}

// ---------- API calls ----------

async function loadPage(offset) {
  isLoading = true;
  updatePager();

  try {
    const response = await fetch(
      `${API_URL}/tasks?offset=${offset}&limit=${PAGE_LIMIT + 1}`,
      {
        headers: {
          "X-User-ID": local_id,
        },
      },
    );
    if (!response.ok)
      throw new Error(`Server responded with ${response.status}`);

    const apiResponse = await response.json();
    const tasks = apiResponse.data;

    if (tasks.length === 0 && offset > 0) {
      return await loadPage(Math.max(0, offset - PAGE_LIMIT));
    }

    currentOffset = offset;
    hasNextPage = tasks.length > PAGE_LIMIT;
    taskList.replaceChildren(
      ...tasks.slice(0, PAGE_LIMIT).map(createTaskElement),
    );
    updateSummary();
    return true;
  } catch (error) {
    console.log("Error: ", error);

    if (taskList.children.length === 0) {
      showListMessage(
        "Couldn't load your tasks. Make sure the API is running, then refresh.",
        true,
      );
    } else {
      showNotice("Couldn't load that page. Try again.");
      updateSummary();
    }
    return false;
  } finally {
    isLoading = false;
    updatePager();
  }
}

// Moves to another page, then brings the top of the list back into view
async function goToPage(offset) {
  clearNotice();

  const loaded = await loadPage(offset);
  if (!loaded) return;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  tasksPanel.scrollIntoView({
    behavior: prefersReducedMotion ? "auto" : "smooth",
    block: "start",
  });
  tasksTitle.focus({ preventScroll: true });
}

prevButton.addEventListener("click", () =>
  goToPage(Math.max(0, currentOffset - PAGE_LIMIT)),
);
nextButton.addEventListener("click", () =>
  goToPage(currentOffset + PAGE_LIMIT),
);

// Create a new task when user presses submit button
form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const newTaskName = taskInput.value.trim();
  if (!newTaskName) return;

  if (checkForDuplicateTask(newTaskName)) {
    showNotice("Task with this name already exists.", true);
    return;
  }

  clearNotice();

  let tempTask = createTaskElement({
    task_name: newTaskName,
    isDone: false,
    task_id: -++tempIdCounter,
  });

  tempTask.classList.add("task--temp");

  if (!hasNextPage && taskList.children.length < PAGE_LIMIT) {
    taskList.appendChild(tempTask);
  } else if (taskList.children.length >= PAGE_LIMIT) {
    showNotice("Task added. It's on a later page.", false);
    updatePager();
  }

  submitButton.disabled = true;
  taskInput.value = "";

  setTimeout(() => {
    ((submitButton.disabled = false), taskInput.focus());
  }, submitCooldownTimeInMs);

  updateSummary();
  updatePager();

  try {
    const response = await fetch(`${API_URL}/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-ID": local_id,
      },
      body: JSON.stringify({
        task_name: tempTask.querySelector(".task__name").textContent,
        is_done: false,
      }),
    });

    if (!response.ok)
      throw new Error(`Server responded with ${response.status}`);

    const responseData = await response.json();
    tempTask.dataset.taskId = responseData.data.task_id;

    if (hasNextPage) {
      showNotice("Task added. It's on a later page.", false);
    }

    tempTask.classList.remove("task--temp");
  } catch (error) {
    console.log("Error: ", error);
    showNotice(
      "Couldn't add that task. Check that the API is running and try again.",
    );
    console.log(error);
    tempTask.remove();
  } finally {
    submitButton.disabled = false;
    taskInput.focus();
  }
});

let currentController = null;
// Update Task Completed Status
taskList.addEventListener("change", async (event) => {
  const taskItem = event.target.closest(".task");
  if (taskItem.classList.contains("task--temp")) {
    showNotice("Task is still being created. Please wait.", true);
    return;
  }

  if (!event.target.classList.contains("task__toggle")) return;

  if (currentController) {
    currentController.abort();
  }

  currentController = new AbortController();
  const { signal } = currentController;

  event.target.disabled = true;
  setTimeout(() => {
    event.target.disabled = false;
  }, completeTaskCooldownTimeInMs);

  const checkbox = event.target;
  let checkedState = checkbox.checked;

  let taskId = checkbox.closest(".task").dataset.taskId;
  updateSummary();

  try {
    const response = await fetch(`${API_URL}/tasks/${taskId}`, {
      method: "PATCH",
      headers: {
        "X-User-ID": local_id,
      },
      signal: signal,
    });
    if (!response.ok)
      throw new Error(`Server responded with ${response.status}`);

    const responseData = await response.json();
    checkbox.checked = responseData.data.is_done;
  } catch (error) {
    if (error.name === "AbortError") {
      console.log("Request aborted");
      taskItem.classList.remove("task--updating");
      updateSummary();
      return;
    }

    console.log("Error: ", error);
    checkbox.checked = checkedState;
    showNotice("Couldn't update that task. Try again.");
  } finally {
    currentController = null;
  }
});

// Clear all completed tasks
clearCompletedButton.addEventListener("click", async (event) => {
  event.preventDefault();

  try {
    const loaderElement = document.createElement("span", {
      class: "loader",
      parent: clearCompletedButton,
    });

    const pendingTaskDeletions = optimisticRemoveTasks();

    clearCompletedButton.appendChild(loaderElement);
    updateSummary();

    const response = await fetch(`${API_URL}/tasks/completed/`, {
      method: "DELETE",
      headers: {
        "X-User-ID": local_id,
      },
    });

    loaderElement.remove();
    loadPage(currentOffset);

    if (!response.ok)
      throw new Error(`Server responded with ${response.status}`);
  } catch (error) {
    console.log("Error: ", error);
    showNotice("Couldn't clear completed tasks. Try again.");
    restorePendingTaskDeletions(pendingTaskDeletions);
  }
});

// Edit Task
taskList.addEventListener("click", (event) => {
  const editButton = event.target.closest(".task__edit");
  if (!editButton) return;

  const taskItem = editButton.closest(".task");
  const taskEditContainer = createTaskEditPopup(taskItem);
  document.body.appendChild(taskEditContainer);
});

//close task edit popup
document.body.addEventListener("click", (event) => {
  if (!event.target.closest(".task__edit-popup__cancel")) return;

  const taskEditPopup = event.target.closest(".task__edit-popup");
  if (taskEditPopup) {
    taskEditPopup.remove();
  }
});

// Delete a task (event delegation on the list)
taskList.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest(".task__delete");
  if (!deleteButton) return;

  const taskItem = deleteButton.closest(".task");

  clearNotice();
  deleteButton.disabled = true;

  try {
    const response = await fetch(
      `${API_URL}/tasks/${taskItem.dataset.taskId}`,
      {
        method: "DELETE",
        headers: {
          "X-User-ID": local_id,
        },
      },
    );
    if (!response.ok)
      throw new Error(`Server responded with ${response.status}`);

    taskItem.classList.add("task--removing");
    setTimeout(() => {
      taskItem.remove();
    }, 160);
  } catch (error) {
    console.log("Error: ", error);
    deleteButton.disabled = false;
    showNotice("Couldn't delete that task. Try again.");
  }
});

loadPage(0);
