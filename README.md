# Trainer Tracker

A multi-user trainer management application: admin portal, trainer self-registration with
approval, trainer profiles + monthly availability, a training calendar with recurring
series, per-session trainer assignment (accept/decline), and in-app messaging.

## Features

- **Roles** — `ADMIN` and `TRAINER`, sign-in via session cookie (`tt_token`, httpOnly, SameSite=Lax).
  Admin-kind accounts additionally hold a custom **access role** (Settings → Roles) built from a
  fixed permission catalog (settings, users, roles, trainers, sessions, registrations), so an
  admin can create restricted staff accounts instead of every admin having full access.
- **System settings** — an admin with the `settings.manage` permission configures the SMTP email
  server and the sign-in session timeout from the Settings page; changes apply immediately, no
  restart required. `SMTP_*` / `JWT_EXPIRES_IN` in `server/.env` only seed the initial values.
- **User management** — admins with `users.manage` can create accounts directly (staff or
  trainer, with a temporary password) from the Users page, in addition to approving
  self-registrations.
- **Registration** — trainers register with their own password; an admin approves/rejects.
  Approved registrations auto-link to a matching seeded profile (by email) or create a new one.
- **Profiles** — trainers maintain their profile, preferences, and a 12-month availability grid.
  Admin-only fields (meeting status/date, willingness, free/voluntary, fee, follow-up) are
  never exposed to trainers. Survey data from the import is shown read-only to the trainer.
- **Sessions & series** — admins create one-off sessions or weekly/monthly recurring series
  (`until` inclusive, capped so no series exceeds 100 occurrences). Any number of trainers can
  be assigned; each receives a system message and may accept or decline once.
- **Calendar** — read-only month calendar for trainers (their accepted sessions highlighted);
  interactive planning calendar for admins. All times are display-fixed to `Asia/Dubai`.
- **Messaging** — 1:1 and group DMs, plus an automatic per-session chat thread for all
  assigned trainers and admins. Unread counts badge the inbox and header.
- **Notifications** — system messages on assignment, accept/decline, approval, rejection,
  password reset, reminder. An optional SMTP transport also forwards these as emails
  (leave `SMTP_*` blank for pure in-app messaging).

## Stack

- Frontend: React 19 + Vite 8 + TypeScript + Tailwind 4 + luxon + react-router 7.
- Backend: Express 5 + TypeScript, Prisma 7 (PostgreSQL 16 via `@prisma/adapter-pg`; portable to
  MySQL by changing the provider in `server/prisma/schema.prisma` and the adapter in `server/src/db.ts`).
- Auth: bcrypt + JWT in an httpOnly cookie (session timeout configurable in Settings);
  `express-rate-limit` on login; zod validation on all bodies.

## Repository layout

```
trainer-tracker/
  package.json          workspace root (dev/build/start/db scripts)
  docker-compose.yml    optional local PostgreSQL 16
  server/               Express + Prisma API
    prisma/             schema.prisma, migrations, seed (trainers-seed.json is gitignored)
    src/                lib/, routes/, middleware/, scripts/create-admin.ts
  client/               Vite + React app
    src/pages/          Login, Register, Dashboard, Profile, Calendar, MySessions,
                        Inbox, AdminDashboard, AdminRegistrations, AdminTrainers, AdminCalendarPage,
                        AdminSettings, AdminUsers, AdminRoles
    src/components/     Shell, MonthCalendar, drawers/modals, form fields
```

## Prerequisites

- Node.js 20+ and npm 10+
- PostgreSQL 16 reachable at `127.0.0.1:5432` (or use `docker compose up -d`)

## Setup

```bash
# 1. Create the database and a role (adjust to taste)
sudo -u postgres psql -c "CREATE ROLE trainer LOGIN PASSWORD 'trainer_dev_pass';"
sudo -u postgres psql -c "CREATE DATABASE trainer_tracker OWNER trainer;"

# 2. Copy and edit environment variables
cp server/.env.example server/.env
#   set DATABASE_URL, JWT_SECRET, PORT=3000, APP_TZ=Asia/Dubai,
#   and the default ADMIN_EMAIL / ADMIN_PASSWORD used by create-admin

# 3. Install, migrate, load the 48 seed trainers, create the admin
npm install
npm run db:migrate
npm run db:seed
npm run create:admin

# 4a. Run in dev (API on :3000 with Vite proxy on :5173)
npm run dev

# 4b. Or build + run in production (Express serves the compiled client)
npm run build
npm start          # http://localhost:3000
```

Default admin sign-in: `admin@example.com` / `Admin123!` — change the password after your
first sign-in (or set `ADMIN_PASSWORD` before `create:admin`).

## Environment variables (`server/.env`)

| Variable         | Example                              | Meaning |
|------------------|--------------------------------------|---------|
| `DATABASE_URL`   | `postgresql://trainer:***@127.0.0.1:5432/trainer_tracker` | Prisma connection string |
| `JWT_SECRET`     | random string                        | Signs session cookies |
| `PORT`           | `3000`                               | API port |
| `CLIENT_DIST`    | `../client/dist` (default)           | Static client build served by Express |
| `APP_TZ`         | `Asia/Dubai`                         | Display timezone for all datetimes |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | — | Bootstrap credentials for `create:admin` |
| `JWT_EXPIRES_IN` | `7d` | Seeds the initial session timeout; edit it in Settings afterwards |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | — | Seeds the initial email server config; edit it in Settings afterwards |

## API overview (all under `/api`)

- `auth` — register, login, logout, me, change-password, request-reset
- `trainers` — own profile + availability (`/trainers/me`)
- `sessions` — calendar listing, create/assign/respond/patch/cancel (admin vs trainer views)
- `messaging` — thread list, `/people` picker, messages, read marks
- `notifications` — unread totals + latest message
- `admin` — KPIs, registrations (approve/reject), trainer CRUD + availability, account
  password-reset/disable/enable, user CRUD + access-role assignment, custom roles CRUD,
  system settings (SMTP, session timeout)

## Reminders

- WeChat-style in-app messaging is the primary channel; **e-mail is optional** via SMTP.
- Session reminder sweep runs hourly on the server and posts an in-app reminder 2h before start.
- The seed file (`server/prisma/trainers-seed.json`, extracted from the original
  `TrainerTracker.jsx`) is gitignored and idempotent — re-running `npm run db:seed` is a no-op.