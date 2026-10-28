# TaskFlow

TaskFlow is a team project management app. The planned stack is FastAPI, SQLAlchemy, MySQL, and React.

## Project layout

- `backend/` — FastAPI service
- `frontend/` — Vite + React app
- `project_plan.md` — feature scope and implementation plan

## Run the backend

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API health endpoint is available at `http://localhost:8000/health`; interactive API docs are at `http://localhost:8000/docs`.

## Run the frontend

```powershell
cd frontend
npm install
npm run dev
```

Vite prints the local URL, usually `http://localhost:5173`.

## Configuration

Copy `backend/.env.example` to `backend/.env` before configuring the database and API secrets. Never commit `.env` files or real credentials.
