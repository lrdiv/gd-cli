# Repository Guidelines

## Project Structure & Module Organization
- `src/cli.ts`: Commander entrypoint; defines a global `--verbose` flag, registers `shows`, `today`, and `info`, and prints help when run without args.
- `src/commands/shows.ts`: Hosts both `registerShows` and `registerToday`; parses dates, drives the shared workflow, and encapsulates Inquirer prompts plus browser launching logic.
- `src/services/grateful-dead-archive.ts`: Grateful Dead Archive API client with injectable `fetch`; exposes `getShowsForDate`, `getShowsForToday`, `openShowInBrowser`, and helpers for formatting/grouping recordings.
- `dist/`: Build output from `npm run build`; never edit or check in changes manually.

## Build, Test, and Development Commands
- `npm install`: Installs CLI dependencies (`commander`, `chalk`, `ora`, `execa`, `inquirer`, `tsup`, `tsx`, `TypeScript`).
- `npm run dev -- <args>`: Runs the CLI via `tsx`; forward command args, e.g., `npm run dev -- shows 1977-05-08 --auto`.
- `npm run build`: Bundles `src/cli.ts` with `tsup`; emits ESM plus declaration files into `dist/`.
- `npm run start -- <args>`: Executes the packaged CLI from `dist/cli.js`; mirrors the production runtime.
- `npm run typecheck`: Runs `tsc --noEmit` for strict typing before opening PRs.

## Coding Style & Naming Conventions
- Use TypeScript ESM targeting Node 18+; annotate exports and rely on inference for locals.
- Maintain two-space indentation and logical import grouping; let editor-formatting stand in for a linter.
- Name command files with verbs (`shows.ts`) and export `register<Feature>` helpers returning a configured `Command`.
- Keep user output styled via `chalk`, wrap long-running work in `ora` spinners, and keep interactive prompts scoped to command modules through `inquirer`.

## Testing Guidelines
- No automated test runner yet; add `node --test` (or similar) and wire it to `npm test` when introduced.
- Stub `fetchImpl` when exercising `GratefulDeadArchiveClient` to avoid live archive.org calls.
- Manually verify with `npm run dev -- shows 1977-05-08` (interactive) and `npm run dev -- today --auto` to confirm both browser flows.

## Commit & Pull Request Guidelines
- Current snapshot lacks Git history; adopt Conventional Commits (`feat: add auto mode for shows`).
- Keep commits scoped to one command or service; isolate refactors from feature changes.
- PR descriptions should summarize intent, list manual/typecheck results, and include CLI output captures when UX shifts.
- Link issues and flag new runtime deps or config knobs so reviewers can verify deployment impact.

## Security & Configuration Tips
- Archive.org API uses no secrets; if future services need creds, load via env vars and never hardcode them.
- Centralize new HTTP clients under `src/services/` to share retry logic and simplify mocking in tests.
