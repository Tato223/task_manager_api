const taskDisplayContainer = document.querySelector(".task-display__container");
taskDisplayContainer.addEventListener("click", (event) => {
  if (event.target.classList.contains("task__delete-btn")) {
    const taskDiv = event.target.closest(".task");
    const taskId = taskDiv.dataset.taskId;

    fetch(`http://127.0.0.1:8000/tasks/${taskId}`, {
      method: "DELETE"
    });
  }
});

//Initial API call, GETS and formats each row of DB
fetch("http://127.0.0.1:8000/tasks?offset=0&limit=20")
  .then((response) => response.json())
  .then((apiResponse) => {
    apiResponse.data.forEach((task) => {
      const taskElement = createTaskElement(task);
      taskDisplayContainer.append(taskElement);
    });
  })
  .catch((error) => console.log("Error: ", error));

// Create a new task when user presses submit button
const form = document.querySelector(".input-form");
form.addEventListener("submit", function (event) {
  event.preventDefault();
  user_task_input = document.querySelector(".input-form__text");
  new_task_name = user_task_input.value;
  console.log(new_task_name);

  fetch("http://127.0.0.1:8000/tasks?offset=0&limit=20", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      task_name: new_task_name,
      is_done: false,
    }),
  });
});

// converts tasks from DB to html elements
function createTaskElement(task) {
  const taskDiv = document.createElement("div");
  taskDiv.className = "task";
  taskDiv.dataset.taskId = task.task_id;

  const taskName = document.createElement("span");
  taskName.className = "task__name";
  taskName.textContent = task.task_name;

  const taskButtonsDiv = document.createElement("div");
  taskButtonsDiv.className = "task__buttons";

  const checkbox = document.createElement("input");
  checkbox.className = "task__submit-btn";
  checkbox.type = "checkbox";
  checkbox.checked = task.is_done;

  const taskDeleteButton = document.createElement("button");
  taskDeleteButton.className = "task__delete-btn";
  taskDeleteButton.textContent = "Delete";

  taskDiv.append(taskName, taskButtonsDiv);

  taskButtonsDiv.append(checkbox, taskDeleteButton);

  return taskDiv;
}