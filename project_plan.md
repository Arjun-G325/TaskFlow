# Project Plan: TaskFlow — Team Project Management Tool with Collaboration, Analytics & AI Assist

## 1. Project Overview

TaskFlow is a full-stack project management web application (similar to a lightweight Trello/Jira) built by a 2-person team. Users create projects, add team members, and manage tasks on a kanban-style board (cards moving across To Do / In Progress / Done columns).

Beyond the board, TaskFlow is a real **team collaboration tool**:
- A **task view** showing the parent task and its subtasks
- A **subtask detail view** showing a subtask's details, comments, and full history
- **Comments** on subtasks (the leaf work items), not on parent tasks
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
| Email verification | Brevo transactional email API for one-time signup codes |
| Google sign-in | `@react-oauth/google` (frontend) + `google-auth` (backend token verification) |
| AI | Google Gemini API (free tier) |
| Backend hosting | Render or Railway (free tier) |
| Frontend hosting | Vercel (free tier) |
| Database hosting | Railway MySQL or Aiven MySQL (free tier) |

---

## 3. Core Features

### Base features
1. **Auth** — During signup, the user verifies ownership of their email using either Google or a one-time code sent through Brevo. Both options lead to the same signup form, where the user chooses a unique username and password. The account is created only after email verification and credential submission. Sign-in supports either username/password or Google. Google verification never gives TaskFlow the user's Google password. Store passwords only as secure hashes.
2. **Projects** — create/view/edit/delete a project, list all projects a user belongs to
3. **Project Members** — add a user to a project by email, roles: owner / member
4. **Tasks** — create/view/edit/delete tasks within a project; fields: title, description, status (todo/in_progress/done), multiple assignees, due date, priority, created by
5. **Kanban Board** — drag-and-drop tasks between status columns, updates DB on drop
6. **AI Assist** — button on task creation/edit: user types a short title, clicks "AI Assist," AI generates a description + 3-5 subtasks, user can edit before saving

### Collaboration & analytics features
7. **Task and Subtask Detail Views** — parent tasks remain the Kanban cards and contain subtasks. A task view shows the parent task and its subtasks. Clicking a subtask opens its own detail view with its details, **all comments** from everyone oldest to newest, and its **change history** (for example, "Ravi created this" or "Priya completed it").
8. **Comments** — any project member can comment on a subtask (for example, "Add image upload to this screen"). Comments belong to the subtask, not the parent task.
9. **Notifications** — bell icon with unread count; notifications are created for:
   - You are assigned a task
   - Someone comments on a subtask you created or are assigned to
   - Status of a task or subtask you created or are assigned to changes
   - A deadline is close (due within 24 hours) or missed (overdue)
   - You are added to a project

   Clicking a notification opens the related task or subtask. "Mark all as read" button.
10. **Activity Board (who did what)** — a feed like "Priya completed 'Build login' — 2 hours ago", filterable by person
11. **Progress Board (how is the project going)** — charts showing tasks by status, % completed, overdue tasks, workload per member, and tasks completed per week

---

## 4. Database Schema (MySQL via SQLAlchemy)

```sql
-- users
id            INT PK AUTO_INCREMENT
username      VARCHAR(50) UNIQUE NOT NULL
name          VARCHAR(100) NULLABLE                 -- optional display name
email         VARCHAR(150) UNIQUE NOT NULL
password_hash VARCHAR(255) NOT NULL                 -- every signup creates TaskFlow credentials
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
project_id    INT FK -> projects.id, composite PK
user_id       INT FK -> users.id, composite PK
role          ENUM('owner', 'member') DEFAULT 'member'

-- tasks
id            INT PK AUTO_INCREMENT
project_id    INT FK -> projects.id
title         VARCHAR(200) NOT NULL
description   TEXT
status        ENUM('todo', 'in_progress', 'done') DEFAULT 'todo'
created_by_id INT FK -> users.id NOT NULL          -- NEW: who created/assigned it
due_at        DATETIME NULLABLE                      -- deadline date and time
priority      ENUM('low', 'medium', 'high') DEFAULT 'medium'
completed_at  DATETIME NULLABLE                    -- NEW: set when moved to done (for analytics)
created_at    DATETIME DEFAULT CURRENT_TIMESTAMP    -- task creation time
updated_at    DATETIME ON UPDATE CURRENT_TIMESTAMP  -- last task update time

-- task_assignees: many-to-many relationship between tasks and assigned users
task_id       INT FK -> tasks.id, composite PK
user_id       INT FK -> users.id, composite PK

-- subtasks
id              INT PK AUTO_INCREMENT
task_id         INT FK -> tasks.id
title           VARCHAR(200) NOT NULL
description     TEXT NULLABLE
is_done         BOOLEAN DEFAULT FALSE
is_ai_generated BOOLEAN DEFAULT FALSE
updated_at      DATETIME ON UPDATE CURRENT_TIMESTAMP

-- ai_logs
id            INT PK AUTO_INCREMENT
task_id       INT FK -> tasks.id
prompt_sent   TEXT
ai_response   TEXT
was_accepted  BOOLEAN DEFAULT NULL
created_at    DATETIME DEFAULT CURRENT_TIMESTAMP

-- comments on leaf subtasks                         -- NEW
id            INT PK AUTO_INCREMENT
subtask_id    INT FK -> subtasks.id NOT NULL
user_id       INT FK -> users.id
body          TEXT NOT NULL
created_at    DATETIME DEFAULT CURRENT_TIMESTAMP

-- activity_log                                     -- NEW
id            INT PK AUTO_INCREMENT
project_id    INT FK -> projects.id
task_id       INT FK -> tasks.id NULLABLE
subtask_id    INT FK -> subtasks.id NULLABLE
user_id       INT FK -> users.id                    -- who did the action
action        VARCHAR(50) NOT NULL                  -- e.g. task_created, task_assigned, status_changed, subtask_updated, comment_added, member_added
details       JSON NULLABLE                         -- e.g. {"field": "description", "before": "Old text", "after": "Updated text"}
created_at    DATETIME DEFAULT CURRENT_TIMESTAMP

-- notifications                                    -- NEW
id            INT PK AUTO_INCREMENT
user_id       INT FK -> users.id                    -- who receives it
task_id       INT FK -> tasks.id NULLABLE
subtask_id    INT FK -> subtasks.id NULLABLE
project_id    INT FK -> projects.id NULLABLE
message       VARCHAR(255) NOT NULL
is_read       BOOLEAN DEFAULT FALSE
created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
```

---

## 5. API Endpoints (FastAPI)

```
POST   /auth/email-code                # send one-time signup code through Brevo
POST   /auth/email-code/verify         # verify code; return short-lived signup token
POST   /auth/google                    # verify Google identity; existing account signs in,
                                       # new account receives short-lived signup token
POST   /auth/register                  # signup token + username + password creates account
POST   /auth/login                     # username + password returns TaskFlow JWT

GET    /projects
POST   /projects
GET    /projects/{id}
PUT    /projects/{id}
DELETE /projects/{id}

POST   /projects/{id}/members
GET    /projects/{id}/members

GET    /projects/{id}/tasks
POST   /projects/{id}/tasks    # accepts assignee_ids: [user_id, ...]
GET    /tasks/{id}             # parent task details and subtask list
PUT    /tasks/{id}             # may replace assignee_ids
DELETE /tasks/{id}
PATCH  /tasks/{id}/status      # for drag-and-drop updates

POST   /tasks/{id}/ai-assist   # calls Gemini, returns description + subtasks
POST   /tasks/{id}/subtasks
PUT    /subtasks/{id}          # edit subtask title and description
PATCH  /subtasks/{id}          # update completion state or other individual fields
DELETE /subtasks/{id}
GET    /subtasks/{id}          # full subtask detail, comments, and history

POST   /subtasks/{id}/comments         # NEW
GET    /subtasks/{id}/comments         # NEW

GET    /projects/{id}/activity         # NEW: activity feed, ?user_id= filter
GET    /projects/{id}/analytics        # NEW: data for the Progress board

GET    /notifications                  # NEW: current user's notifications
PATCH  /notifications/{id}/read        # NEW
POST   /notifications/read-all         # NEW
```

---

## 6. AI Integration Details

**Provider:** Google Gemini API (free tier)

**Trigger:** User creates or edits a task, enters a title (e.g. "Set up user authentication"), and chooses an AI action such as generating a description or subtasks.

**Planned agent workflow:**
1. Frontend sends `POST /tasks/{id}/ai-assist` with the title, selected action, and relevant task context.
2. Backend reads role instructions, action-specific guidance, and restrictions from a prompt file. These define what the AI agent is responsible for and what it must not do.
3. The agent works through multiple bounded stages before returning an answer: understand the requested action and task, plan a suitable result, draft it, then review it against the instructions and output requirements.
4. Backend validates the result and asks for a correction if it fails validation, with a strict limit on retries.
5. The final result is saved to `ai_logs` and returned to the frontend. The user can review and edit it before saving the task.
6. When the user saves, backend updates `ai_logs.was_accepted` based on whether the suggestion was used as generated or edited.

**Restrictions:** The agent only drafts task content. It must follow the role and action-specific rules in its instruction files, return the requested structured output, and never create or modify project data by itself. The user remains in control and approves any suggested content before it is saved.

**Output format:** Return strict JSON for the requested action, with a description, a list of subtasks, or both as appropriate.

**Error handling:** If Gemini fails, returns invalid output, or cannot produce a result within the bounded workflow, show a toast such as "AI suggestion failed, please fill manually". AI failure must not block task creation.

---

## 7. Activity, Notification & Analytics Design

### The key design idea: one `record_event()` helper
Every important action goes through ONE backend helper function, e.g. `record_event(db, user, project_id, task, action, details)`. It does two things:
1. Inserts a row into `activity_log`
2. Creates `notifications` rows for the right people

Endpoints (create task, assign, change status, create/edit/delete a subtask, comment on a subtask, add member) just call this helper. Every subtask event stores its `subtask_id` (and its parent `task_id`) in `activity_log`. For edits, `details` records the changed field and its before/after values; `user_id` identifies who made the change and `created_at` records when. The subtask detail view reads its history from those rows. This gives us the activity feed, subtask history, and notifications from one piece of code.

### Who gets notified
| Event | Notified |
|---|---|
| Task assigned / reassigned | each newly assigned user |
| Comment added to a subtask | parent task creator + all task assignees (except the commenter) |
| Task or subtask status changed | parent task creator + all task assignees (except the person who changed it) |
| Added to a project | the added user |
| Due within 24 hours / overdue | all task assignees (and creator for overdue) |

Never notify a user about their own action.

### Deadline checker
A scheduled job (APScheduler, runs hourly) finds tasks that are due within 24 hours or overdue and not done, and creates notifications. To avoid duplicates, skip a task if a deadline notification of the same type already exists for it today.

### Analytics endpoint
`GET /projects/{id}/analytics` returns aggregated data computed with SQL `GROUP BY` queries:
- Task count per status
- Completion percentage
- Overdue tasks (due_date < today and status != done)
- Tasks per assignee (workload), split by status; a task assigned to several people counts once for each assignee
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
      ai_agent.py            # bounded multi-stage AI workflow
      event_service.py       # record_event(): activity log + notifications
      scheduler.py           # APScheduler deadline checker
    prompts/
      agent_instructions.md  # agent role, action guidance, and restrictions
    auth/
      jwt_handler.py
      google_auth.py          # verifies Google ID token and email ownership
      email_verification.py   # code generation, expiry, and Brevo delivery
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
      TaskDetailPanel.jsx    # parent task and its subtask list
      SubtaskDetailPanel.jsx # subtask details, comments, and history
      CommentList.jsx / CommentForm.jsx # comments attached to a subtask
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

### Day 2 (~7 hrs each) — Auth, email verification, and Google sign-in
- **Person A:**
  - Build username/password registration and login, JWT generation, password hashing, and `get_current_user` dependency (3 hrs)
  - Build email-code signup flow using Brevo: generate a one-time code, set an expiry and resend/attempt limits, verify it, and issue a short-lived signup token (2 hrs)
  - Build Google verification: verify the Google ID token and verified email; sign in an existing linked account or issue a short-lived signup token for a new account. Both signup methods finish at the shared username/password form (2 hrs)
- **Person B:**
  - Build signup screens for Google-or-email-code verification, then the shared username/password form; build username/password login and AuthContext (5 hrs)
  - Add `GoogleLoginButton` with `@react-oauth/google` and connect it to `/auth/google` (1-2 hrs)
- **Both (first 30 min):** Configure Google OAuth Client ID and allowed origins. Set up Brevo sender/API key for transactional email and configure local environment variables. Add production origins when deploying.
- **Security rules:** Keep Brevo API key server-side; never commit it. Store verification codes hashed with short expiry, limit attempts/resends, and create no account until verification and credential submission both succeed.

### Day 3 (5 hrs each)
- **Person A:** Build Projects CRUD endpoints + Project Members endpoints
- **Person B:** Build Dashboard page (list of projects), Create Project modal, Project detail page skeleton

### Day 4 (5 hrs each)
- **Person A:** Build Tasks CRUD endpoints (set `created_by_id` on create, set `completed_at` when status becomes done) + status PATCH endpoint + Subtasks endpoints
- **Person B:** Build Kanban board UI with drag-and-drop (`@dnd-kit`), Task cards, Task creation/edit modal (without AI yet)

### Day 5 (5 hrs each)
- **Person A:** Build `ai_agent.py` with prompt-file instructions and a bounded multi-stage workflow, `POST /tasks/{id}/ai-assist` endpoint, `ai_logs` saving logic, and graceful error handling/fallback
- **Person B:** Wire "AI Assist" button in Task modal to the endpoint, show loading state, pre-fill description/subtasks, allow editing before save

### Day 6 (~7 hrs each) — Task detail, comments, activity log
- **Person A:**
  - Build `event_service.record_event()` and call it from task create, assign, status change, subtask create/edit/delete, and member add endpoints (4 hrs)
  - Build subtask comment endpoints, and make `GET /subtasks/{id}` return subtask details, comments, and history (3 hrs)
- **Person B:**
  - Build `TaskDetailPanel` for the parent task and subtask list, plus `SubtaskDetailPanel` with subtask comments and history (5 hrs)
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
