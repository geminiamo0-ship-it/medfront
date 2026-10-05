# Repository Guidelines

## Project Structure & Module Organization
The backend is a NestJS + TypeORM project.
- `src/`: domain modules (`auth`, `users`, `tests`, `subscriptions`, etc.) with controllers, services, and DTOs.
- `src/entities/`: database entities.
- `src/migrations/`: timestamped TypeORM migrations.
- `src/database/` and `src/scripts/`: seed/import/maintenance scripts.
- `scripts/`: root utility scripts (for example `reset-db.ts`).
- `lab-pdfs/`: JSON input data for import jobs.
- `dist/`: compiled output (generated; do not edit directly).




## Build, Test, and Development Commands
- `npm run start:dev`: run the API in watch mode.
- `npm run build`: compile NestJS and bundle worker output.
- `npm run start:prod`: run compiled output from `dist/main`.
- `npm run lint`: run ESLint with auto-fixes.
- `npm run format`: run Prettier on TypeScript sources.
- `npm run test`, `npm run test:cov`, `npm run test:e2e`: unit, coverage, and e2e test commands.
- `npm run migration:run:dev` / `npm run migration:revert:dev`: run or rollback migrations against TS sources.
- `npm run seed` (and `npm run seed:profiles`): seed development data.

## Coding Style & Naming Conventions
Use TypeScript with NestJS patterns and 2-space indentation.
- Keep module files grouped by domain under `src/<domain>/`.
- Use `PascalCase` for classes and `camelCase` for methods/variables.
- Use suffix conventions: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.dto.ts`, `*.entity.ts`.
- Migration filenames should stay timestamp-prefixed (for example `1740000001000-CreateUsers.ts`).
- Run `npm run format` and `npm run lint` before opening a PR.

## Testing Guidelines
Jest is configured for `src` with `*.spec.ts` naming.
- Add new tests as `<feature>.spec.ts` near the code under test.
- Cover service logic and auth/guard behavior for changed modules.
- Run `npm run test` locally for all PRs; use `npm run test:cov` for high-impact changes.
- For API behavior changes, validate endpoints via Swagger (`/api/docs`) or the Postman collection.

## Commit & Pull Request Guidelines
Recent history uses `feat:` and `fix:` prefixes with merge commits. Prefer Conventional Commit style:
- `feat: add suspended test resume endpoint`
- `fix: correct omitted question status handling`

PRs should include:
- brief summary and scope,
- linked issue/task,
- migration or seed impact,
- env/config changes (if any),
- test evidence (commands run and results),
- sample request/response for changed endpoints when relevant.

## Security & Configuration Tips
- Copy `.env.example` to `.env`; never commit secrets.
- Prefer migrations over schema sync (`synchronize` stays `false`).
- Set `DB_SSL=true` when using managed Postgres that requires SSL.
