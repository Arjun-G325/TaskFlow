# Project Plan: TaskFlow — Team Project Management Tool with Collaboration, Analytics & AI Assist

## 1. Project Overview

TaskFlow is a full-stack project management web application (similar to a lightweight Trello/Jira) built by a 2-person team. Users create projects, add team members, and manage tasks on a kanban-style board (cards moving across To Do / In Progress / Done columns).

Beyond the board, TaskFlow is a real **team collaboration tool**:
- A **task detail view** showing everything about a task: who created it, who it is assigned to, description, subtasks, every comment, and full history
- **Comments** on every task
- **Notifications** for anything relevant (assignments, comments, status changes, deadlines)
- An **Activity board** showing who did what, and a **Progress board** with charts for tracking project progress
- **Sign in with Google** (Gmail login) alongside normal email/password login
- ONE **AI feature**: an "AI Assist" button that, given a short task title, auto-generates a description and subtasks using the Gemini API

**Important framing:** This is a software engineering project with AI integrated as a single feature — NOT an AI/ML project. There is no model training, no datasets, no data pipeline. The AI integration is one HTTP API call to an LLM (Gemini), and its output is stored in the database like any other user-generated content.

**Target completion:** ~7 working days plus a half-day buffer, 2 people in parallel, ~39 hours each (~78 hours total: ~50 hrs core + ~4 hrs Google sign-in + ~20 hrs collaboration/analytics features + ~4 hrs testing/deploy).

**Repository:** GitLab (`gitlab.com/group-name7170842/dxs-project-management-tool`).

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Backend | FastAPI (Python) |
| ORM | SQLAlchemy |
| Database | MySQL (hosted free on Railway or Aiven) |
| Frontend | React + Tailwind CSS |
| Drag-and-drop (kanban) | `@dnd-kit/core` |
| Charts | Recharts |
| Scheduled jobs (deadline alerts) | APScheduler |
| Auth | JWT (`python-jose`) + password hashing (`passlib[bcrypt]`) |
| Google sign-in | `@react-oauth/google` (frontend) + `google-auth` (backend token verification) |
| AI | Google Gemini API (free tier) |
| Backend hosting | Render or Railway (free tier) |
| Frontend hosting | Vercel (free tier) |
| Database hosting | Railway MySQL or Aiven MySQL (free tier) |

---

## 3. Core Features

### Base features
1. **Auth** — register, login, JWT-based session, password hashing, plus **"Continue with Google"** sign-in. Google users are found or created by email; if the email already exists from a password signup, the Google login links to that same account instead of creating a duplicate. Email/password login stays as a fallback.
2. **Projects** — create/view/edit/delete a project, list all projects a user belongs to
3. **Project Members** — add a user to a project by email, roles: owner / member
4. **Tasks** — create/view/edit/delete tasks within a project; fields: title, description, status (todo/in_progress/done), assignee, due date, priority, created by
5. **Kanban Board** — drag-and-drop tasks between status columns, updates DB on drop
6. **AI Assist** — button on task creation/edit: user types a short title, clicks "AI Assist," AI generates a description + 3-5 subtasks, user can edit before saving

### Collaboration & analytics features
7. **Task Detail View** — clicking a task shows everything in one place:
   - Title, description, status, priority, due date
   - **Created by** (who assigned it) and **Assigned to** (who must do it)
   - Subtasks checklist (including AI-generated ones)
   - **All comments** from everyone, oldest to newest, like a chat
   - **History** of changes (e.g. "Ravi created this", "Ravi assigned it to Priya", "Priya moved it to In Progress")
8. **Comments** — any project member can comment on any task (e.g. "I need the API done before I can start the UI")
9. **Notifications** — bell icon with unread count; notifications are created for:
   - You are assigned a task
   - Someone comments on a task you created or are assigned to
   - Status of a task you created or are assigned to changes
   - A deadline is close (due within 24 hours) or missed (overdue)
   - You are added to a project

   Clicking a notification opens the related task. "Mark all as read" button.
10. **Activity Board (who did what)** — a feed like "Priya completed 'Build login' — 2 hours ago", filterable by person
11. **Progress Board (how is the project going)** — charts showing tasks by status, % completed, overdue tasks, workload per member, and tasks completed per week

---

## 4. Database Schema (MySQL via SQLAlchemy)

```sql
-- users
id            INT PK AUTO_INCREMENT
name          VARCHAR(100)
email         VARCHAR(150) UNIQUE NOT NULL
password_hash VARCHAR(255) NULLABLE                -- CHANGED: null for Google-only users
google_id     VARCHAR(100) UNIQUE NULLABLE         -- NEW: Google account id
avatar_url    VARCHAR(500) NULLABLE                -- NEW: profile photo from Google
created_at    DATETIME DEFAULT CURRENT_TIMESTAMP

-- projects
id            INT PK AUTO_INCREMENT
name          VARCHAR(150) NOT NULL
description   TEXT
owner_id      INT FK -> users.id
created_at    DATETIME DEFAULT CURRENT_TIMESTAMP

-- project_members
id            INT PK AUTO_INCREMENT
project_id    INT FK -> projects.id
user_id       INT FK -> users.id
role          ENUM('owner', 'member') DEFAULT 'member'

-- tasks
id            INT PK AUTO_INCREMENT
project_id    INT FK -> projects.id
title         VARCHAR(200) NOT NULL
description   TEXT
status        ENUM('todo', 'in_progress', 'done') DEFAULT 'todo'
created_by_id INT FK -> users.id NOT NULL          -- NEW: who created/assigned it
assignee_id   INT FK -> users.id NULLABLE
due_date      DATE NULLABLE
priority      ENUM('low', 'medium', 'high') DEFAULT 'medium'
completed_at  DATETIME NULLABLE                    -- NEW: set when moved to done (for analytics)
created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
updated_at    DATETIME ON UPDATE CURRENT_TIMESTAMP

-- subtasks
id              INT PK AUTO_INCREMENT
task_id         INT FK -> tasks.id
title           VARCHAR(200) NOT NULL
is_done         BOOLEAN DEFAULT FALSE
is_ai_generated BOOLEAN DEFAULT FALSE

-- ai_logs
id            INT PK AUTO_INCREMENT
task_id       INT FK -> tasks.id
prompt_sent   TEXT
ai_response   TEXT
was_accepted  BOOLEAN DEFAULT NULL
created_at    DATETIME DEFAULT CURRENT_TIMESTAMP

-- comments                                         -- NEW
id            INT PK AUTO_INCREMENT
task_id       INT FK -> tasks.id
user_id       INT FK -> users.id
body          TEXT NOT NULL
created_at    DATETIME DEFAULT CURRENT_TIMESTAMP

-- activity_log                                     -- NEW
id            INT PK AUTO_INCREMENT
project_id    INT FK -> projects.id
task_id       INT FK -> tasks.id NULLABLE
user_id       INT FK -> users.id                    -- who did the action
action        VARCHAR(50) NOT NULL                  -- e.g. task_created, task_assigned, status_changed, comment_added, member_added
details       JSON NULLABLE                         -- e.g. {"from": "todo", "to": "in_progress", "assignee": "Priya"}
created_at    DATETIME DEFAULT CURRENT_TIMESTAMP

-- notifications                                    -- NEW
id            INT PK AUTO_INCREMENT
user_id       INT FK -> users.id                    -- who receives it
task_id       INT FK -> tasks.id NULLABLE
project_id    INT FK -> projects.id NULLABLE
message       VARCHAR(255) NOT NULL
is_read       BOOLEAN DEFAULT FALSE
created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
```

---

## 5. API Endpoints (FastAPI)

```
POST   /auth/register
POST   /auth/login
POST   /auth/google            # NEW: receives Google token, verifies it, returns our JWT

GET    /projects
POST   /projects
GET    /projects/{id}
PUT    /projects/{id}
DELETE /projects/{id}

POST   /projects/{id}/members
GET    /projects/{id}/members

GET    /projects/{id}/tasks
POST   /projects/{id}/tasks
GET    /tasks/{id}             # full detail: creator, assignee, subtasks, comments, history
PUT    /tasks/{id}
DELETE /tasks/{id}
PATCH  /tasks/{id}/status      # for drag-and-drop updates

POST   /tasks/{id}/ai-assist   # calls Gemini, returns description + subtasks
POST   /tasks/{id}/subtasks
PATCH  /subtasks/{id}

POST   /tasks/{id}/comments            # NEW
GET    /tasks/{id}/comments            # NEW

GET    /projects/{id}/activity         # NEW: activity feed, ?user_id= filter
GET    /projects/{id}/analytics        # NEW: data for the Progress board

GET    /notifications                  # NEW: current user's notifications
PATCH  /notifications/{id}/read        # NEW
POST   /notifications/read-all         # NEW
```

---

## 6. AI Integration Details

**Provider:** Google Gemini API (free tier)

**Trigger:** User creates/edits a task, types a title (e.g. "Set up user authentication"), clicks "AI Assist."

**Flow:**
1. Frontend sends `POST /tasks/{id}/ai-assist` with `{ title: "..." }`
2. Backend builds a prompt and calls Gemini API
3. Gemini is instructed to return **strict JSON** in this shape:
```json
{
  "description": "Short 1-2 sentence description of the task.",
  "subtasks": ["Subtask 1", "Subtask 2", "Subtask 3"]
}
```
4. Backend parses the JSON, saves the raw prompt + response into `ai_logs`, and returns the parsed result to frontend
5. Frontend pre-fills the description field and subtask list; user can edit before saving
6. When user saves, backend updates `ai_logs.was_accepted` based on whether the content was changed

**Example prompt template:**
```
You are a project management assistant. Given the following task title from a software project, 
generate a short description (max 2 sentences) and 3-5 concrete, actionable subtasks.

Task title: "{title}"

Respond ONLY with valid JSON in this exact format, no extra text:
{
  "description": "...",
  "subtasks": ["...", "...", "..."]
}
```

**Error handling:** if Gemini API fails or returns malformed JSON, fall back gracefully (show a toast "AI suggestion failed, please fill manually") — do not block task creation.

---

## 7. Activity, Notification & Analytics Design

### The key design idea: one `record_event()` helper
Every important action goes through ONE backend helper function, e.g. `record_event(db, user, project_id, task, action, details)`. It does two things:
1. Inserts a row into `activity_log`
2. Creates `notifications` rows for the right people

Endpoints (create task, assign, change status, comment, add member) just call this helper. This gives us the task history, the Activity board, and all notifications from one piece of code.

### Who gets notified
| Event | Notified |
|---|---|
| Task assigned / reassigned | the new assignee |
| Comment added | task creator + assignee (except the commenter) |
| Status changed | task creator + assignee (except the person who changed it) |
| Added to a project | the added user |
| Due within 24 hours / overdue | the assignee (and creator for overdue) |

Never notify a user about their own action.

### Deadline checker
A scheduled job (APScheduler, runs hourly) finds tasks that are due within 24 hours or overdue and not done, and creates notifications. To avoid duplicates, skip a task if a deadline notification of the same type already exists for it today.

### Analytics endpoint
`GET /projects/{id}/analytics` returns aggregated data computed with SQL `GROUP BY` queries:
- Task count per status
- Completion percentage
- Overdue tasks (due_date < today and status != done)
- Tasks per assignee (workload), split by status
- Tasks completed per week (using `completed_at`)

The Progress board renders these with Recharts (bar chart for status/workload, line chart for weekly completion, a progress bar for % complete).

---

## 8. Folder Structure

**Backend (`/backend`)**
```
backend/
  app/
    main.py
    config.py              # env vars, DB URL, Gemini API key
    database.py             # SQLAlchemy engine/session
    models/                 # user.py, project.py, task.py, comment.py, activity.py, notification.py
    schemas/                # Pydantic schemas (request/response)
    routers/                # auth.py, projects.py, tasks.py, ai.py, comments.py,
                            #   activity.py, analytics.py, notifications.py
    services/
      ai_service.py          # Gemini API call logic, prompt building
      event_service.py       # record_event(): activity log + notifications
      scheduler.py           # APScheduler deadline checker
    auth/
      jwt_handler.py
      google_auth.py          # verifies Google ID token, finds/creates/links user
      dependencies.py         # get_current_user
  requirements.txt
  .env
```

**Frontend (`/frontend`)**
```
frontend/
  src/
    components/
      KanbanBoard.jsx
      TaskCard.jsx
      TaskModal.jsx          # create/edit, includes AI Assist button
      TaskDetailPanel.jsx    # full task view: people, subtasks, comments, history
      CommentList.jsx / CommentForm.jsx
      NotificationBell.jsx   # bell icon, unread count, dropdown list
      ProjectList.jsx
      Login.jsx / Register.jsx
      GoogleLoginButton.jsx  # "Continue with Google" button
    pages/
      Dashboard.jsx
      ProjectPage.jsx        # kanban board
      ActivityPage.jsx       # who did what
      ProgressPage.jsx       # charts
    api/
      client.js               # axios instance with JWT interceptor
      tasks.js, projects.js, auth.js, comments.js, notifications.js, analytics.js
    context/
      AuthContext.jsx
    App.jsx
  tailwind.config.js
```

---

## 9. Timeline (2 People, Parallel Work)

**Person A = Backend & DB owner | Person B = Frontend & AI feature owner**

Days 1-5 build the core (~5 hrs each per day). Days 6-7 add the collaboration and analytics features (~7 hrs each per day). Day 8 is a half-day for testing and deployment.

### Day 1 (5 hrs each)
- **Both:** Finalize schema together (including the new tables), set up GitLab repo, agree on API contract (endpoints + request/response shapes from Section 5)
- **Person A:** Set up FastAPI project skeleton, connect to MySQL (Railway), create SQLAlchemy models for all tables, run initial migration
- **Person B:** Set up React project (Vite + Tailwind), set up routing, build static Login/Register pages (no logic yet), set up Axios client

### Day 2 (~7 hrs each) — Auth, including Google sign-in
- **Person A:**
  - Build auth endpoints (register/login), JWT generation, password hashing, `get_current_user` dependency (5 hrs)
  - Build `POST /auth/google`: verify the Google token with `google-auth`, find or create the user by email, link to an existing account if the email already exists, return our JWT (2 hrs)
- **Person B:**
  - Build Login/Register forms with real API calls, AuthContext for storing JWT, protected route wrapper (5 hrs)
  - Add `GoogleLoginButton` with `@react-oauth/google` and connect it to `/auth/google` (1-2 hrs)
- **Both (first 30 min):** Create the OAuth Client ID in Google Cloud Console and add it to both `.env` files. Add `http://localhost:5173` as an allowed origin now, and the Vercel URL when you deploy.
- **Tip:** Build email/password login first. If Google setup gives trouble, you still have a working login.

### Day 3 (5 hrs each)
- **Person A:** Build Projects CRUD endpoints + Project Members endpoints
- **Person B:** Build Dashboard page (list of projects), Create Project modal, Project detail page skeleton

### Day 4 (5 hrs each)
- **Person A:** Build Tasks CRUD endpoints (set `created_by_id` on create, set `completed_at` when status becomes done) + status PATCH endpoint + Subtasks endpoints
- **Person B:** Build Kanban board UI with drag-and-drop (`@dnd-kit`), Task cards, Task creation/edit modal (without AI yet)

### Day 5 (5 hrs each)
- **Person A:** Build `ai_service.py` (Gemini API call + prompt), `POST /tasks/{id}/ai-assist` endpoint, `ai_logs` saving logic, error handling/fallback
- **Person B:** Wire "AI Assist" button in Task modal to the endpoint, show loading state, pre-fill description/subtasks, allow editing before save

### Day 6 (~7 hrs each) — Task detail, comments, activity log
- **Person A:**
  - Build `event_service.record_event()` and call it from task create, assign, status change, and member add endpoints (4 hrs)
  - Build comments endpoints, and make `GET /tasks/{id}` return creator, assignee, subtasks, comments, and history (3 hrs)
- **Person B:**
  - Build `TaskDetailPanel` (opens when a task card is clicked) with people, subtasks, comments list, comment form, and history (5 hrs)
  - Start the Progress page layout with Recharts placeholder charts (2 hrs)

### Day 7 (~7 hrs each) — Analytics, notifications
- **Person A:**
  - Build `GET /projects/{id}/activity` and `GET /projects/{id}/analytics` first so Person B can connect to them (3 hrs)
  - Build notifications endpoints, notification creation inside `record_event()`, and the hourly deadline checker with APScheduler (4 hrs)
- **Person B:**
  - Build Activity page with a per-person filter (2 hrs)
  - Connect Progress page charts to the analytics endpoint (2 hrs)
  - Build `NotificationBell` with unread count, dropdown, click-to-open-task, and "mark all as read" (3 hrs)

### Day 8 (half day, ~4 hrs each) — Test, deploy, document
- **Both together:** End-to-end testing with 2 accounts (assign a task, comment, check the other account gets notified), fix integration bugs
- **Both together:** Deploy backend (Render/Railway) + frontend (Vercel) + MySQL (Railway/Aiven), then add the deployed Vercel URL as an authorized origin in the Google OAuth settings so Google login works in production
- Write README with setup instructions and a short architecture diagram
- Prepare demo script (see Section 11)

---

## 10. Stretch Goals (only if time remains, or after the main build)

- **GitLab/GitHub webhook linking (~7 hrs):** Link a repo to a project, add a `POST /webhooks/gitlab` endpoint that verifies the secret token, and attach commits mentioning a task (e.g. `closes #12`) to that task via a `task_commits` table. Optionally auto-move the task to Done when a merge request merges.
- **Live board updates with WebSockets (~5 hrs):** When one person drags a card, everyone viewing the board sees it move without refreshing.
- **AI weekly digest (~3 hrs):** Feed the week's `activity_log` to Gemini and get back "what got done, what's blocked, what's at risk".
- **AI usage dashboard:** Page showing count of AI suggestions accepted vs edited (`ai_logs.was_accepted`)
- **@mentions in comments:** Typing `@Priya` creates a notification for her
- **Task dependencies ("blocked by"):** Self-referencing table, with a warning when moving a task whose blockers are not done
- **GitLab CI + Docker:** Auto-run tests and deploy on push

---

## 11. Demo Script

1. Register two users in two browser windows (Ravi and Priya)
2. Ravi creates a project and adds Priya by email → Priya gets a notification
3. Ravi creates a task using **AI Assist**, assigns it to Priya → Priya's bell shows a new notification
4. Priya opens the task detail panel: sees who created it, who it's assigned to, subtasks, and history
5. Ravi and Priya exchange comments → each gets notified of the other's comment
6. Priya drags the card to In Progress, then Done → Ravi gets notified
7. Open the **Activity board**: "Priya completed 'Set up auth'"
8. Open the **Progress board**: charts update with the completed task, workload per person, and weekly progress

---

## 12. What to Emphasize in Placement Interviews

- This is a **software engineering project** with a scoped AI feature, not an ML project — be ready to say this explicitly
- Talk about the **`record_event()` design**: one central function that powers the activity feed, task history, and notifications, instead of duplicating logic in every endpoint
- Talk about the **`ai_logs` table** as a deliberate design choice to track AI accuracy/usage over time
- Talk about **graceful degradation**: the app works fully even if the AI call fails
- Be ready to explain the **auth flow** (JWT), the **many-to-many relationship** (project_members), and **one specific API design decision** you made
- Talk about **Google OAuth**: the backend never trusts the frontend's claim of identity, it verifies Google's signed token, then issues its own JWT. Also explain how you link a Google login to an existing email/password account instead of creating a duplicate
- Talk about **scheduled jobs**: how the deadline checker works and how you avoid duplicate notifications
- Talk about **SQL aggregation** behind the analytics endpoint (GROUP BY queries for status, workload, and weekly completion)
