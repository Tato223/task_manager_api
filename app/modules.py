from typing import Optional, TypeVar, Generic
from pydantic import BaseModel
from sqlmodel import Field, Relationship, SQLModel


# Task object for SQLite
class Task(SQLModel, table=True):
    task_id: int | None = Field(default=None, primary_key=True)
    task_name: str = Field(
        index=True,
    )
    is_done: bool = False
    task_owner_id: Optional[str] = Field(
        default=None, foreign_key="user.user_id", ondelete="CASCADE"
    )
    owner: "User" = Relationship(back_populates="tasks")


class User(SQLModel, table=True):
    user_id: str | None = Field(primary_key=True)
    tasks: Optional[list["Task"]] = Relationship(back_populates="owner")


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


class UserCreate(SQLModel):
    user_id: str = Field(primary_key=True)
