from app.backend.main import app, get_session
from fastapi import Depends
from fastapi.testclient import TestClient
import pytest
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session

# Create the fake DB in-memory

Database_URL = "sqlite:///:memory:"

test_engine = create_engine(
    Database_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool
)

TEST_USER = "2sbxv6`pl"


def create_db_and_tables():
    SQLModel.metadata.create_all(test_engine)


@pytest.fixture(name="session", scope="session")
def session_fixture():
    create_db_and_tables()
    with Session(test_engine) as session:
        yield session
    SQLModel.metadata.drop_all(test_engine)


@pytest.fixture(name="client")
def client_fixture(session: Session):
    def override_get_session():
        yield session

    app.dependency_overrides[get_session] = override_get_session
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


def test_read_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"Status: ": "Task Manager API is running!"}


def test_create_user(client):
    response = client.post(
        "/users/",
        json={"user_id": TEST_USER},
    )
    assert response.status_code == 201


def test_create_duplicate_user(client):
    response = client.post(
        "/users/",
        json={"user_id": TEST_USER},
    )
    assert response.status_code == 400


def test_read_tasks(client):
    response = client.get("/tasks?offset=0&limit=20", headers={"X-User-ID": TEST_USER})
    assert response.status_code == 200
    assert "data" in response.json()


def test_create_task(client):
    response = client.post(
        "/tasks",
        headers={"X-User-ID": TEST_USER},
        json={"task_name": "Test Task", "is_done": False},
    )
    assert response.status_code == 200
    assert "data" in response.json()


def test_create_task_missing_name(client):
    response = client.post(
        "/tasks",
        headers={"X-User-ID": TEST_USER},
        json={"is_done": False},
    )
    assert response.status_code == 422


def test_create_task_missing_is_done(client):
    response = client.post(
        "/tasks",
        headers={"X-User-ID": TEST_USER},
        json={"task_name": "Test Task"},
    )
    assert response.status_code == 200
    assert "data" in response.json()


def test_create_task_missing_headers(client):
    response = client.post(
        "/tasks",
        json={"task_name": "Test Task", "is_done": False},
    )
    assert response.status_code == 422


def test_create_task_missing_all(client):
    response = client.post(
        "/tasks",
        headers={"X-User-ID": TEST_USER},
        json={},
    )
    assert response.status_code == 422


def test_read_specific_user(client):
    response = client.get(
        f"/users/{TEST_USER}",
        headers={"X-User-ID": TEST_USER},
    )
    assert response.status_code == 200
    assert response.json() == {"data": {"user_id": TEST_USER}}


def test_read_nonexistent_user(client):
    response = client.get(
        f"/users/{'nonexistent_user'}",
        headers={"X-User-ID": TEST_USER},
    )
    assert response.status_code == 404
    assert response.json() == {"detail": "Not found - User does not exist"}


def test_delete_task(client):

    get_task_response = client.get(f"/tasks/", headers={"X-User-ID": TEST_USER})
    tasks_list = get_task_response.json().get("data", [])
    print(tasks_list)

    response = client.delete(
        f"/tasks/{tasks_list[0]['task_id']}",
        headers={"X-User-ID": TEST_USER},
    )

    assert response.status_code == 200
    assert "data" in response.json()


def test_update_task_is_done(client):
    get_task_response = client.get(f"/tasks/", headers={"X-User-ID": TEST_USER})
    tasks_list = get_task_response.json().get("data", [])

    response = client.patch(
        f"/tasks/{tasks_list[0]['task_id']}",
        headers={"X-User-ID": TEST_USER},
    )

    assert response.status_code == 200
    assert "data" in response.json()


def test_update_task_name(client):
    get_task_response = client.get(f"/tasks/", headers={"X-User-ID": TEST_USER})
    tasks_list = get_task_response.json().get("data", [])

    response = client.patch(
        f"/tasks/{tasks_list[0]['task_id']}/name",
        headers={"X-User-ID": TEST_USER},
        json={"task_name": "Updated Task Name"},
    )

    assert response.status_code == 200
    assert "data" in response.json()


def test_clear_completed_tasks(client):
    response = client.delete(
        "/tasks/completed/",
        headers={"X-User-ID": TEST_USER},
    )
    assert response.status_code == 204


def test_clear_completed_tasks_without_completed_tasks(client):
    response = client.delete(
        "/tasks/completed/",
        headers={"X-User-ID": TEST_USER},
    )
    assert response.status_code == 204
