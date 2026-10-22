import * as apiService from "./services/apiService.js";
import * as uiService from "./services/uiService.js";
import { state } from "./services/stateService.js";
import * as taskService from "./services/taskService.js";

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
state.isPaginated = state.currentOffset > 0 || state.hasNextPage;
state.scope = state.isPaginated ? " on this page" : "";

uiService.loadPage(state.currentOffset);

// Create a new task on form submission
uiService.form.addEventListener("submit", async (event) => {
  await taskService.createTaskEvent(event);
});

// Update Task Completed Status
uiService.taskList.addEventListener("change", async (event) => {
  await taskService.updateTaskCompletionEvent(event);
});

// Clear all completed tasks
uiService.clearCompletedButton.addEventListener("click", async (event) => {
  await taskService.clearCompletedTasksEvent(event);
});

// open Edit Task popup
uiService.taskList.addEventListener("click", async (event) => {
  uiService.showTaskEditPopup(event);
});

// Change task name
document.body.addEventListener("submit", async (event) => {
  await taskService.updateTaskNameEvent(event);
});

//close task edit popup
document.body.addEventListener("click", (event) => {
  if (!event.target.closest(".task__edit-popup__cancel")) return;

  uiService.closeTaskEditPopup();
});

// Delete a task
uiService.taskList.addEventListener("click", async (event) => {
  await taskService.deleteTaskEvent(event);
});
