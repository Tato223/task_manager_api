# Priora Task Manager

A full-stack task manager with a FastAPI REST backend, a MySQL database, and a framework-free JavaScript frontend. Priora focuses on a fast, responsive interface: changes appear instantly in the UI and are reconciled with the server in the background.

**Live demo:** [Priora](https://priora-task.vercel.app/) <br>
**API docs:** [Priora/docs](https://priora-backend.vercel.app/docs/)

![Priora main interface](og-image.png)

## Highlights

- **Full-stack REST architecture.** A vanilla JavaScript client talks to a FastAPI backend over a JSON API, with the backend and frontend served from a single repository.
- **Optimistic UI.** Creating, editing, and deleting tasks updates the interface immediately, then syncs with the server and rolls back if a request fails.
- **Relational database design.** Users and tasks are stored in MySQL (hosted on Aiven) with a one-to-many relationship between a user and their tasks.
- **Offset/limit pagination.** Task lists are fetched in pages so the client never loads more data than it needs.
- **Automated tests.** A pytest suite covers every API endpoint, including happy paths and edge cases, against an isolated in-memory SQLite database.
- **Hand-built DOM layer.** All rendering and event handling is written in plain JavaScript, with no framework or build step.

## Tech Stack

| Layer      | Technology                                   |
| ---------- | -------------------------------------------- |
| Frontend   | HTML, CSS, JavaScript                        |
| Backend    | Python, FastAPI, Pydantic                    |
| Database   | MySQL (Aiven) in production, SQLite in tests |
| Testing    | pytest                                       |
| Deployment | Vercel                                       |

## Architecture

The frontend is organized into small service modules, each with a single responsibility:

| Module         | Responsibility                                           |
| -------------- | -------------------------------------------------------- |
| `apiService`   | All network requests to the backend                      |
| `stateService` | Client-side state for the current user and task list     |
| `taskService`  | Task logic that coordinates state changes with API calls |
| `uiService`    | DOM rendering and updates                                |
| `app.js`       | Entry point; wires events to the services                |

### Optimistic UI flow

1. The user performs an action, such as adding or deleting a task.
2. `taskService` updates local state and `uiService` re-renders immediately.
3. `apiService` sends the request in the background.
4. On success, local state is reconciled with the server response. On failure, the change is reverted and the user is notified.

### User identity

Priora does not implement authentication. On a visitor's first load, the backend creates a user and the client stores the returned user ID in `localStorage`. That ID is sent in an `X-User-ID` header on every user-specific request, so each browser sees only its own tasks. Because the ID is not a secret credential, this is a lightweight guest model and is not suitable for sensitive data. Adding real authentication is the first item on the roadmap.

## API Documentation

FastAPI generates interactive documentation automatically. With the server running, open `/docs` for Swagger UI or `/redoc` for ReDoc.

![Swagger UI for the Priora API](image-1.png)

## Testing

The test suite lives in `tests/test_api.py`. Each test runs against a temporary SQLite database that replaces the production dependency, so tests are fast, isolated, and never touch real data.

Coverage includes:

- Every endpoint, for both successful requests and error responses
- Validation failures and requests for resources that do not exist
- Database operations verified alongside the API responses

```bash
pytest
```

## Getting Started

### Prerequisites

- Python 3.14.6 or newer
- A MySQL database, or any SQLModel-compatible database URL for local development

### Setup

```bash
git clone https://github.com/Tato223/task_manager_api.git
cd task_manager_api

python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in the project root:

```env
DATABASE_URL=mysql+pymysql://USER:PASSWORD@HOST:PORT/DB_NAME
```

Start the server:

```bash
uvicorn app.backend.main:app --reload
```

The app is served at `http://127.0.0.1:8000` and the API docs at `http://127.0.0.1:8000/docs`.

## Project Structure

```
.
├── app
│   ├── backend        # FastAPI application, models, and routes
│   └── frontend       # HTML, CSS, and JavaScript service modules
├── tests
│   └── test_api.py    # API and database tests
├── pytest.ini
└── README.md
```

## Roadmap

- Real authentication to replace the guest user ID
- Task due dates and priorities
- Filtering and search

## What I Learned

- Designing a client where state, rendering, and network code are separated into focused modules
- Keeping the UI and server consistent when updates are applied optimistically
- Structuring a REST API and its relational schema around per-user data
- Testing API behavior against an isolated database rather than mocking individual functions

## Author

**Dante**, Computer Science student at Morgan State University
