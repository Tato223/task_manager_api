from typing import Annotated, Optional, TypeVar, Generic
from datetime import datetime
from fastapi import Depends, FastAPI, HTTPException, Request, Query
from fastapi.concurrency import asynccontextmanager
from pydantic import BaseModel
from random import randint
from sqlalchemy import create_engine
from sqlmodel import Field, SQLModel, Session, delete, func, select

# Database file and url to create
sqlite_file_name = "database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

# Engine instance
connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, connect_args=connect_args)


# Create the database
def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


# Create session for engine to interact with database
def get_session():
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]


# Task object for SQLite
class Task(SQLModel, table=True):
    task_id: int | None = Field(default=None, primary_key=True)
    task_name: str = Field(
        index=True,
    )
    # due_date : datetime | None = None
    is_done: bool = False


# Generic response model
T = TypeVar("T")


class Response(BaseModel, Generic[T]):
    data: T


class PaginatedResponse(BaseModel, Generic[T]):
    data: T
    next: Optional[str]
    prev: Optional[str]


# Response model for creating/udpating
class TaskCreate(SQLModel):
    task_name: str = Field(index=True)
    is_done: bool = Field(default=False)


# Create database on startup with test tables
@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield


# Initialize the FastAPI app
taskManager = FastAPI(root_path="/api/v1", lifespan=lifespan)


# Define a route for the root URL ("/") that returns a simple JSON response
@taskManager.get("/")
async def home():
    return {"Status: ": "Task Manager API is running!"}


# Read all tasks from database
@taskManager.get("/tasks", response_model=PaginatedResponse[list[Task]])
async def read_tasks(
    request: Request,
    session: SessionDep,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20),
):

    all_tasks = session.exec(
        select(Task).order_by(Task.task_id).offset(offset).limit(limit) # type: ignore
    ).all()

    base_url = str(request.url).split("?")[0]

    next_url = f"{base_url}?offset={offset + limit}&limit{limit}"

    if offset > 0:
        prev_url = f"{base_url}?offset={max(0, offset - limit)}&limit={limit}"
    else:
        prev_url = None

    return {"data": all_tasks, "next": next_url, "prev": prev_url}


# Read task with ID
@taskManager.get("/tasks/{task_id}", response_model=Response[Task])
async def read_task_by_id(task_id: int, session: SessionDep):

    this_task = session.get(Task, task_id)
    if not this_task:
        raise HTTPException(404, "Not found - Task does not exist")

    return {"data": this_task}


# Create a new task
@taskManager.post("/tasks", response_model=Response[Task])
async def create_task(task: TaskCreate, session: SessionDep):

    # Pass in TaskCreate object which omits automatic fields
    db_task = Task.model_validate(task)
    session.add(db_task)
    session.commit()
    session.refresh(db_task)

    return {"data": db_task}


# Change is_done value of a task
@taskManager.patch("/tasks/{task_id}", response_model=Response[Task])
async def update_task_status(task_id: int, session: SessionDep):

    updated_task = session.get(Task, task_id)
    print(updated_task)

    if not updated_task:
        raise HTTPException(404, "Not found - Task does not exist")

    updated_task.is_done = not updated_task.is_done
    session.commit()
    session.refresh(updated_task)

    return {"data": updated_task}


# Delete the last task
@taskManager.delete("/tasks/last", response_model=Response[list[Task]])
async def remove_last_task(session: SessionDep):

    last_task = session.exec(select(Task).order_by(Task.task_id.desc())).first() # type: ignore

    if not last_task:
        raise HTTPException(404, "Not found! -- no tasks to delete")

    session.delete(last_task)
    session.commit()

    remaining_tasks = session.exec(select(Task).order_by(Task.task_id)).all() # type: ignore

    return {"data": remaining_tasks}


# Delete specific task
@taskManager.delete("/tasks/{task_id}", response_model=Response[list[Task]])
async def remove_specific_task(task_id: int, session: SessionDep):

    task_to_delete = session.get(Task, task_id)
    if not task_to_delete:
        raise HTTPException(404, "Not found! -- task does not exist")

    session.delete(task_to_delete)
    session.commit()

    remaining_tasks = session.exec(select(Task)).all()

    return {"data": remaining_tasks}


# Clear the task list
@taskManager.delete("/tasks")
async def clear_tasks(session: SessionDep):

    session.exec(delete(Task))
    session.commit()

    raise HTTPException(204, "Tasks have been cleared.")


print("Successfully compiled!")