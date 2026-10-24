import * as apiService from "./services/apiService.js";
import * as uiService from "./services/uiService.js";
import { state } from "./services/stateService.js";
import * as taskService from "./services/taskService.js";

// ---------- User ID ----------

function generateUserID() {
  const id = new Uint32Array(1);
  crypto.getRandomValues(id);
  return id[0].toString(36);
}

async function ensureUser() {
  const existing = localStorage.getItem("user_id");
  if (existing) return existing;

  const userId = generateUserID();

  try {
    await apiService.createUser(userId);
  } catch (error) {
    if (error.status !== 409) throw error; // 409 = already created, fine
  }

  localStorage.setItem("user_id", userId);
  return userId;
}

// ---------- Event wiring ----------

function bindEvents() {
  uiService.form.addEventListener("submit", taskService.createTaskEvent);

  uiService.taskList.addEventListener(
    "change",
    taskService.updateTaskCompletionEvent,
  );

  uiService.taskList.addEventListener("click", (event) => {
    uiService.showTaskEditPopup(event);
    taskService.deleteTaskEvent(event);
  });

  uiService.clearCompletedButton.addEventListener(
    "click",
    taskService.clearCompletedTasksEvent,
  );

  uiService.prevButton.addEventListener("click", uiService.goToPreviousPage);
  uiService.nextButton.addEventListener("click", uiService.goToNextPage);

  // edit popup: save
  document.body.addEventListener("submit", taskService.updateTaskNameEvent);

  // edit popup: cancel button
  document.body.addEventListener("click", (event) => {
    if (event.target.closest(".task__edit-popup__cancel")) {
      uiService.closeTaskEditPopup();
    }
  });

  // edit popup: Escape key
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") uiService.closeTaskEditPopup();
  });
}

// ---------- Start ----------

async function init() {
  try {
    state.local_id = await ensureUser();
  } catch (error) {
    console.error("Could not initialise user:", error);
    uiService.showListMessage(
      "Couldn't reach the server. Refresh to try again.",
      true,
    );
    return;
  }

  bindEvents();
  await uiService.loadPage(0);
}

init();
