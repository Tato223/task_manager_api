import { config } from "../config.js";
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

const tasksPanel = document.querySelector(".tasks");
const tasksTitle = document.querySelector(".tasks__title");
const taskList = document.querySelector(".task-list");
const taskTemplate = document.querySelector("#task-template");
const listMessage = document.querySelector(".task-list__message");
const notice = document.querySelector(".notice");
const summary = document.querySelector(".tasks__summary");
const progressFill = document.querySelector(".progress__fill");
const form = document.querySelector(".composer");
const taskInput = document.querySelector(".composer__input");
const submitButton = document.querySelector(".composer__submit");
const pager = document.querySelector(".pager");
const prevButton = document.querySelector(".pager__prev");
const nextButton = document.querySelector(".pager__next");
const pagerStatus = document.querySelector(".pager__status");
const clearCompletedButton = document.querySelector(".tasks__clear");

let currentOffset = 0;
let hasNextPage = false;
let isLoading = false;

// ---------- Display helpers ----------

function createTaskElement(task) {
  const taskItem = taskTemplate.content.firstElementChild.cloneNode(true);
  taskItem.dataset.taskId = task.task_id;

  taskItem.querySelector(".task__name").textContent = task.task_name;
  taskItem.querySelector(".task__toggle").checked = task.is_done;
  taskItem
    .querySelector(".task__delete")
    .setAttribute("aria-label", `Delete task: ${task.task_name}`);

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

  clearNotice();
  submitButton.disabled = true;

  try {
    const response = await fetch(`${API_URL}/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-ID": local_id,
      },
      body: JSON.stringify({
        task_name: newTaskName,
        is_done: false,
        task_owner_id: local_id,
      }),
    });
    if (!response.ok)
      throw new Error(`Server responded with ${response.status}`);

    taskInput.value = "";

    if (hasNextPage) {
      showNotice("Task added. It's on a later page.", false);
    }
  } catch (error) {
    console.log("Error: ", error);
    showNotice(
      "Couldn't add that task. Check that the API is running and try again.",
    );
  } finally {
    submitButton.disabled = false;
    taskInput.focus();
    loadPage(currentOffset);
  }
});

taskList.addEventListener("change", async (event) => {
  event.preventDefault();

  if (!event.target.classList.contains("task__toggle")) return;

  const checkbox = event.target;
  const taskId = checkbox.closest(".task").dataset.taskId;

  clearNotice();

  try {
    const response = await fetch(`${API_URL}/tasks/${taskId}`, {
      method: "PATCH",
      headers: {
        "X-User-ID": local_id,
      },
    });
    if (!response.ok)
      throw new Error(`Server responded with ${response.status}`);

    const apiResponse = await response.json();
    checkbox.checked = apiResponse.data.is_done;
    loadPage(currentOffset);
  } catch (error) {
    console.log("Error: ", error);
    checkbox.checked = !checkbox.checked;
    showNotice("Couldn't update that task. Try again.");
  }
});

// Clear all completed tasks
clearCompletedButton.addEventListener("click", async () => {
  try {
    const response = await fetch(`${API_URL}/tasks/completed/`, {
      method: "DELETE",
      headers: {
        "X-User-ID": local_id,
      },
    });
    if (!response.ok)
      throw new Error(`Server responded with ${response.status}`);
    loadPage(currentOffset);
  } catch (error) {
    console.log("Error: ", error);
    showNotice("Couldn't clear completed tasks. Try again.");
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

    loadPage(currentOffset);
  } catch (error) {
    console.log("Error: ", error);
    deleteButton.disabled = false;
    showNotice("Couldn't delete that task. Try again.");
  }
});

loadPage(0);
