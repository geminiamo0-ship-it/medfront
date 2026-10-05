# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MedPark is a medical education platform (medpark.io) with a monorepo containing two independent projects:

- **MedPark-Backend/** — NestJS API server (TypeScript, PostgreSQL, TypeORM)
- **MedPark-Frontend/** — React SPA (TypeScript, Vite, React Router, TanStack Query)

The platform serves medical exam preparation across five "steps": Step 1, Step 2, Step 3, MR Part 1, MR Part 2 (defined in `MedPark-Frontend/src/utils/steps.ts`). Each step has its own question banks, subjects, systems, and topics.

**Adding a step / exam track:** the frontend single source of truth is the `AppStep` union + `STEP_OPTIONS` list in `MedPark-Frontend/src/utils/steps.ts`; step validation (`isAppStep`) and labels derive from it, and the Create Test `?step=` guard accepts any defined step automatically (no hardcoded `1–5` range). On the backend, a new track needs step-scoped question-bank/subject/system/topic support plus the corresponding data import.

## Development Commands

### Backend (`MedPark-Backend/`)

```bash
npm run start:dev          # Dev server with hot reload (port 3000)
npm run build              # NestJS build + esbuild bundle (for Cloudflare Worker)
npm run lint               # ESLint with auto-fix
npm run test               # Jest unit tests
npm run test:watch         # Jest in watch mode
npm run test:e2e           # End-to-end tests

# Migrations (TypeORM)
npm run migration:run:dev  # Run migrations using TS sources (local dev)
npm run migration:run      # Run migrations using compiled JS (production)
npm run migration:generate -- src/migrations/<Name>  # Auto-generate from entity changes
npm run migration:revert:dev  # Revert last migration (local dev)

# Database
npm run seed               # Run seed runner
npm run db:reset           # Reset database

# Data import (from SQLite source DBs)
npm run import:all         # Import all question banks
npm run import:step1       # Import Step 1 only (also: step2, step3, mrcp1, mrcp2)
```

### Frontend (`MedPark-Frontend/`)

```bash
npm run dev      # Vite dev server (port 5173)
npm run build    # TypeScript check + Vite build + prerender
npm run lint     # ESLint
npm run preview  # Preview production build
```

## Architecture

### Backend

NestJS with standard module/controller/service pattern. Entry points:
- `src/main.ts` — Express server for local dev (includes Swagger at `/mrshady/api/docs`)
- `src/worker.ts` — Cloudflare Worker adapter for production deployment

All API routes are prefixed with `/api` (configurable via `API_PREFIX` env var).

**Key modules:** Auth, Users, Tests, Subscriptions, Library, Contests, Flashcards, Admin, Security, Notebook, Notes, Messages, Affiliate, Careers, Activity, Settings, Email

**Database:** PostgreSQL via TypeORM. Entities in `src/entities/`, migrations in `src/migrations/`. Migrations are numbered sequentially (timestamp-based). `synchronize: false` — always use migrations.

**TypeORM config** (`src/config/typeorm.config.ts`): Set `TYPEORM_ENTITIES=ts` when running CLI commands against TS sources (migration:generate, migration:run:dev). Omit it for compiled JS.

**Caching:** Redis in production (required, fails to start without it), falls back to in-memory in development.

**Auth:** JWT + Passport (local + Google OAuth). Roles: user, admin, super_admin, moderator, marketer, support.

**Tests module** (`src/tests/`) is the most complex — split into multiple services: test-creation, test-execution, test-retrieval, test-analytics, test-ai, block-generation, question-search, analytics-aggregation.

### Frontend

React 19 SPA with file-based page organization. No SSR — uses a prerender script (`scripts/prerender.mjs`) for static pages.

**Routing:** `App.tsx` defines all routes using `react-router-dom` v7 with `createBrowserRouter`. Pages split between public (`src/pages/`), dashboard (`src/pages/dashboard/`), and admin (`src/pages/admin/`).

**State management:** `UserContext` (auth, preferences, subscription status) + TanStack Query for server state. Auth token stored in `localStorage`.

**API layer:** `src/utils/api.ts` — Axios instance pointing to `VITE_API_URL`. Includes automatic 401 handling (clears auth state), subscription modal triggers for premium-gated errors, and security notification handling.

**Admin panel:** Accessed at a configurable prefix path (`VITE_ADMIN_PREFIX` env var → `ADMIN_BASE_PATH` constant). Includes user management, question management, contest management, payment processing, security alerts, and more.

**Support panel:** A simplified, blue-themed dashboard at `SUPPORT_BASE_PATH` (`VITE_SUPPORT_PREFIX` env var, default `Zendesk/medpark/support-channel`) for the `support` role to approve payments and activate accounts. Role-gated (no second-factor gate). Backend in `src/support/` reuses `ManualPaymentService` and exposes **no** wallet balances/KPIs; every approval is logged to the admin audit history tagged `actorRole: 'support'`.

**Performance analytics:** Dedicated subsystem in `src/components/performance/` with ECharts-based visualizations, filters, and analytics cards.

## Environment Variables

Backend requires a `.env` file — see `.env.example`. Key vars: `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, `JWT_SECRET`, `CORS_ORIGIN`, `REDIS_HOST`.

Frontend uses Vite env vars: `VITE_API_URL`, `VITE_ADMIN_PREFIX`, `VITE_SUPPORT_PREFIX`.

## Content Hierarchy

Questions are organized: MainBank → QuestionBank → Subject → System → Topic → Question (with QuestionOptions). Questions can be grouped via QuestionGrouping entities. Users interact through Tests (custom test generation with configurable filters) and Contests (timed competitive events).
