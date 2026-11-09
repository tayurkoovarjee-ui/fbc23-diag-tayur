# Mini Task Tracker

A small task manager. Next.js front end, Express API, SQL Server database, TypeScript everywhere, plain CSS.

The front end only talks to the Express API. Only the API talks to the database.

```
fbc23-diag/
  api/   Express + TypeScript + SQL Server (mssql driver)
  web/   Next.js (App Router) + TypeScript + plain CSS
```

## Run it

You need Node 20 or newer and a SQL Server instance. The quickest way to get one is Docker:

```bash
docker compose up -d
```

That starts SQL Server 2022 on port 1433 with the password in `docker-compose.yml`. If you already have SQL Server running somewhere else, skip this and point the API at it in the next step.

**API** (http://localhost:4000)

```bash
cd api
cp .env.example .env     # then set JWT_SECRET, and the DB_* values if you are not using the Docker setup
npm install
npm run dev
```

On startup the API creates the `TaskTracker` database if it is missing and runs `api/sql/schema.sql`, so there is no separate migration step. The script is safe to run more than once.

**Web** (http://localhost:3000)

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000, create an account, and add some tasks.

**Tests**

```bash
cd api
npm test
```

## What it does

- Create, view, edit, complete and delete tasks (title, description, due date, status)
- Filter the list by status, search title and description, sort by date, title or status
- Sign in, and each account only sees its own tasks
- Validation on both sides. The API is the one that counts, and it sends back errors per field so the form can show them next to the right input.
- Keyboard usable, labelled fields, visible focus, a skip link, status messages read out to screen readers, and a layout that works on a phone

## API

All task routes need an `Authorization: Bearer <token>` header.

| Method | Path | What it does |
| --- | --- | --- |
| POST | `/api/auth/register` | Create an account, returns a token |
| POST | `/api/auth/login` | Sign in, returns a token |
| GET | `/api/tasks` | List tasks. Query: `status`, `search`, `sort`, `order` |
| POST | `/api/tasks` | Create a task |
| GET | `/api/tasks/:id` | One task |
| PUT | `/api/tasks/:id` | Update any of the fields |
| PATCH | `/api/tasks/:id/complete` | Mark as done |
| DELETE | `/api/tasks/:id` | Delete |

Errors always look like `{ "error": "message", "details": [{ "field": "title", "message": "..." }] }`.

## Choices

**SQL Server.** It was the database I was asked to use. I connect with the `mssql` package and write the queries by hand, with every value passed as a parameter. Sort columns come from a fixed lookup, never from the request, and `%` and `_` in a search are escaped so they match literally.

**Plain CSS.** One `globals.css` with a few custom properties for colours. It follows the system light or dark setting. I kept the contrast high enough to read comfortably in both.

**One repo, two folders.** `api/` and `web/` each have their own `package.json`. A monorepo tool would add setup for no real gain with two small apps.

**Data model.** Two tables. `Users` has a unique email and a bcrypt hash. `Tasks` belongs to a user (with cascade delete) and has a status limited to `todo`, `in_progress` or `done` by a CHECK constraint, so a bad value cannot get in even if the API has a bug. The due date is a `DATE` because a task due "on the 15th" has no time zone. There is an index on `(UserId, Status)` because every list query filters by user, and often by status as well.

**Repository interface.** The routes depend on a small `Repo` interface. There is a SQL Server version and an in-memory version, which is what the tests use so they run without a database. The catch is that the SQL code itself is not covered by the automated tests.

## What I cut

- **Tests for the SQL queries and the front end.** The API routes are tested against the in-memory repo. The SQL repo and the React components are not.
- **Password reset, email checks and refresh tokens.** Tokens last 8 hours and then you sign in again.
- **Rate limiting on sign-in.** It should be added before this goes anywhere public.
- **Pagination.** The list returns every task for the user. Fine for a personal list, not for thousands of rows.
- **Deployment.** It runs locally only.

## Known trade-offs

- The sign-in token is kept in `localStorage`, which keeps a refresh signed in but means any script injected into the page could read it. An httpOnly cookie would be safer and is the first thing I would change.
- Deleting uses the browser's confirm box. It is accessible but plain. An undo would be nicer than a confirmation.
- Deleting a user is not supported, so there is nothing to exercise the cascade yet.
