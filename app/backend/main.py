from pydantic.v1 import ValidationError

from app.backend.modules import (
    Task,
    TaskCreate,
    PaginatedResponse,
    Response,
    User,
    UserCreate,
)
from typing import Annotated
from fastapi import Body, Depends, FastAPI, HTTPException, Header, Request, Query
from fastapi.concurrency import asynccontextmanager
from sqlalchemy import create_engine
from sqlmodel import SQLModel, Session, delete, select, create_engine
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.environ["DATABASE_URL"]
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=5,
    pool_recycle=1800,
    pool_timeout=30,
)


# Create the database
def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


# Create session for engine to interact with database
def get_session():
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]


# Create database on startup
@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield


# Initialize the FastAPI app
app = FastAPI(root_path="/api/v1", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5500", "http://127.0.0.1:5500"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["X-User-ID", "Content-Type", "Authorization"],
)


@app.get("/")
async def home():
    return {"Status: ": "Task Manager API is running!"}


@app.get("/tasks", response_model=PaginatedResponse[list[Task]])
async def read_tasks(
    request: Request,
    session: SessionDep,
    x_user_id: str = Header(),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20),
):

    try:
        all_tasks = session.exec(
            select(Task)
            .where(Task.task_owner_id == x_user_id)
            .order_by(Task.task_id)  # type: ignore
            .offset(offset)
            .limit(limit)  # type: ignore
        ).all()

    except Exception as e:
        raise HTTPException(500, "Internal Server Error")

    base_url = str(request.url).split("?")[0]

    next_url = f"{base_url}?offset={offset + limit}&limit={limit}"

    if offset > 0:
        prev_url = f"{base_url}?offset={max(0, offset - limit)}&limit={limit}"
    else:
        prev_url = None

    return {"data": all_tasks, "next": next_url, "prev": prev_url}


@app.get("/tasks/{task_id}", response_model=Response[Task])
async def read_task_by_id(task_id: int, session: SessionDep):

    this_task = session.get(Task, task_id)
    if not this_task:
        raise HTTPException(404, "Not found - Task does not exist")

    return {"data": this_task}


@app.post("/tasks", response_model=Response[Task])
async def create_task(
    task: TaskCreate,
    session: SessionDep,
    x_user_id: str = Header(),
):

    if not session.get(User, x_user_id):
        raise HTTPException(404, "Not found - User does not exist")

    try:
        db_task = Task.model_validate(task)

        db_task.task_owner_id = x_user_id
        db_task.is_done = False

        session.add(db_task)
        db_task.task_owner_id = x_user_id

        session.commit()
        session.refresh(db_task)

        return {"data": db_task}

    except ValidationError as ve:
        raise HTTPException(422, f"Unprocessable Entity - {ve}")


@app.patch("/tasks/{task_id}/name", response_model=Response[Task])
def update_task_name(
    task_id: int,
    session: SessionDep,
    x_user_id: str = Header(),
    new_name: dict = Body(...),
):
    task_to_update = session.get(Task, task_id)
    if not task_to_update:
        raise HTTPException(404, "Not found - Task does not exist")

    if task_to_update.task_owner_id != x_user_id:
        raise HTTPException(403, "Forbidden - You are not the owner of this task")

    task_to_update.task_name = new_name["task_name"]
    session.commit()
    session.refresh(task_to_update)

    return {"data": task_to_update}


@app.patch("/tasks/{task_id}", response_model=Response[Task])
async def update_task_status(
    task_id: int,
    session: SessionDep,
    x_user_id: str = Header(),
):

    updated_task = session.get(Task, task_id)

    if not updated_task:
        raise HTTPException(404, "Not found - Task does not exist")

    if updated_task.task_owner_id != x_user_id:
        raise HTTPException(403, "Forbidden - You are not the owner of this task")

    updated_task.is_done = not updated_task.is_done
    session.commit()
    session.refresh(updated_task)

    return {"data": updated_task}


# Delete specific task
@app.delete("/tasks/{task_id}", response_model=Response[list[Task]], status_code=200)
async def remove_specific_task(
    task_id: int, session: SessionDep, x_user_id: str = Header()
):

    task_to_delete = session.get(Task, task_id)
    if not task_to_delete:
        raise HTTPException(404, "Not found! -- task does not exist")

    if task_to_delete.task_owner_id != x_user_id:
        raise HTTPException(403, "Forbidden - You are not the owner of this task")

    try:
        session.delete(task_to_delete)
        session.commit()

        remaining_tasks = session.exec(
            select(Task).where(Task.task_owner_id == x_user_id)
        ).all()

        return {"data": remaining_tasks}

    except Exception as e:
        raise HTTPException(500, "Internal Server Error")


@app.delete("/tasks/completed/", status_code=204)
async def clear_completed_tasks(session: SessionDep, x_user_id: str = Header()):

    try:
        session.exec(delete(Task).where(Task.is_done == True and Task.task_owner_id == x_user_id))  # type: ignore
        session.commit()

    except Exception as e:
        raise HTTPException(500, "Internal Server Error")

    raise HTTPException(204, "Completed tasks have been cleared.")


@app.post("/users/", status_code=201)
async def create_user(user: UserCreate, session: SessionDep):

    if session.get(User, user.user_id):
        raise HTTPException(400, "User already exists")

    try:
        db_user = User.model_validate(user)
        session.add(db_user)
        session.commit()
        session.refresh(db_user)
        return {"data": db_user}

    except ValidationError as ve:
        raise HTTPException(422, f"Validation Error: {ve}")


@app.get("/users/{user_id}", response_model=Response[User])
async def read_user_by_id(user_id: str, session: SessionDep):
    db_user = session.get(User, user_id)
    if not db_user:
        raise HTTPException(404, "Not found - User does not exist")
    return {"data": db_user}


@app.get("/users/", response_model=PaginatedResponse[list[User]])
async def read_users(
    request: Request,
    session: SessionDep,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20),
):

    try:
        all_users = session.exec(
            select(User)
            .order_by(User.user_id)
            .offset(offset)
            .limit(limit)  # type: ignore
        ).all()

    except Exception as e:
        raise HTTPException(500, "Internal Server Error")

    base_url = str(request.url).split("?")[0]

    next_url = f"{base_url}?offset={offset + limit}&limit={limit}"

    if offset > 0:
        prev_url = f"{base_url}?offset={max(0, offset - limit)}&limit={limit}"
    else:
        prev_url = None

    return {"data": all_users, "next": next_url, "prev": prev_url}
