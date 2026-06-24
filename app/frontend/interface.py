import requests


def view_tasks():

    specificTask = input("""
    View a specific task? 
    y - Yes
    n - No
    
    Selection: """)

    if specificTask.lower() == "n":

        view_tasks_response = requests.get("http://127.0.0.1:8000/tasks")
        display_tasks(response=view_tasks_response, display_multiple_tasks=True)
        return view_tasks_response.json()

    elif specificTask.lower() == "y":

        task_to_view = int(input("\n" + "Enter the task ID you would like to view: "))
        view_tasks_response = requests.get(
            f"http://127.0.0.1:8000/tasks/{task_to_view}"
        )

        display_tasks(response=view_tasks_response, display_multiple_tasks=False)

        return view_tasks_response.json()

    else:
        print("Invalid response, please try again!")


def create_task():

    taskName = input("\n" + "Enter a name for the task: ")

    newTask = {"task_name": taskName, "task_id": 0, "is_done": False}

    add_task_response = requests.post("http://127.0.0.1:8000/tasks", json=newTask)

    print("\n" + f"Task '{taskName}' successfully created!")
    display_tasks(response=add_task_response, display_multiple_tasks=False)


def remove_task():
    specificTask = input("""
    Remove a specific task?
    
    y - Yes
    n - No
    
    Selection: """)

    if specificTask.lower() == "n":

        delete_task_response = requests.delete("http://127.0.0.1:8000/tasks/last")
        display_tasks(response=delete_task_response, display_multiple_tasks=True)

    elif specificTask.lower() == "y":

        task_to_delete = input("""
    Enter the task ID you would like to remove:
    
    Selection: """)

        delete_task_response = requests.delete(
            f"http://127.0.0.1:8000/tasks/{task_to_delete}/"
        )
        display_tasks(response=delete_task_response, display_multiple_tasks=True)

    else:
        print("Invalid selection. Try again!")


def update_task():
    task_to_update = input("\n" + "Enter the ID of the task you would like to update: ")

    if not task_to_update.isnumeric():

        print("Please enter a valid task ID.")

    else:

        update_task_response = requests.patch(
            f"http://127.0.0.1:8000/tasks/{task_to_update}"
        )
        print(
            "\n"
            + f"Task '{update_task_response.json().get('data').get('task_name')}' has been successfully updated!"
        )

# Format json responses for better user consumption
def display_tasks(response: requests.Response, display_multiple_tasks: bool):

    response_dict = response.json()

    if display_multiple_tasks == True:

        print("\n" + "My Tasks: ")

        for task in response_dict["data"]:

            if task["is_done"] == True:
                status = "✔️"
            else:
                status = "❌"

            print(f"[{task['task_id']}] {task['task_name']} {status}")
    else:

        response_dict = response_dict["data"]

        if response_dict.get("data") == True:
            status = "✔️"
            print(
                f"[{response_dict.get('task_id')}] {response_dict.get('task_name')} {status}"
            )

        else:
            status = "❌"
            print(
                f"[{response_dict.get('task_id')}] {response_dict.get('task_name')} {status}"
            )


# List of functions assigned to menu options
menuOptions = {
    "1": view_tasks,
    "2": create_task,
    "3": remove_task,
    "4": update_task,
    "5": exit,
}

# Call the corresponding function depending on user input
def menuSelect():

    menuResponse = input("""
    __________________________
    What would you like to do?

    1 - View Tasks
    2 - Add a Task
    3 - Remove a Task
    4 - Update a Task
    5 - Exit

    Selection: """)

    # Run associated functions
    if menuResponse in menuOptions:
        menuOptions[menuResponse]()


if __name__ == "__main__":
    while True:
        menuSelect()