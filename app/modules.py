from typing import Optional, TypeVar, Generic
from pydantic import BaseModel
from sqlmodel import Field, SQLModel


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