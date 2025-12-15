# Copilot / AI agent instructions — loan-intake-frontend

Purpose: concise, actionable guidance for AI coding agents working on this repository.

1) Big picture
- This is a Create React App (CRA) frontend (React 19, `react-scripts` 5). The app UI lives under `src/` and static assets under `public/`.
- The workspace currently contains a duplicated CRA scaffold: both the workspace root and `loan-intake-frontend/` contain identical `src/`, `public/`, and `package.json`. Prefer modifying files at the repository root unless the task explicitly targets the nested package.

2) How to build, run, and test (concrete)
- Install dependencies (run from repo root): `npm install`.
- Run development server: `npm start` — opens at http://localhost:3000 and uses `react-scripts start`.
- Run tests: `npm test` — uses CRA test runner.
- Create a production build: `npm run build`.
- If you must operate in the nested copy, run the same commands inside `loan-intake-frontend/`.

3) Project-specific conventions & patterns
- Structure follows default CRA layout: `src/App.js` is the root component, with styling in `src/App.css`.
- Functional components + standard JS imports are used; there are no custom build scripts, routing libraries, or state-management libraries present in this scaffold.
- ESLint/formatting: the `package.json` uses the default `react-app` ESLint config.
- Tests follow CRA conventions under `src/` and are executed via `react-scripts test`.

4) Integration points / external dependencies
- No backend/API integrations were discovered in the current files. There is no `.env` in the repository; use CRA `.env` files (root) if you need runtime configuration.
- Add new HTTP clients (e.g., `axios`) under `src/services` or `src/api` and keep components small and focused.

5) When editing — actionable rules for an AI
- Avoid making simultaneous edits to both root and nested copies unless the change must exist in both places. Prefer the root-level files.
- After code changes, run `npm start` locally to validate UI changes and `npm test` to run tests. Report failing tests and test output when present.
- If adding dependencies, update the root `package.json` and include the `npm install` step in your summary.
- Keep changes minimal and in CRA style (no eject); avoid adding custom Webpack or build steps without explicit instruction.

6) Useful file references (examples)
- Root entry: `package.json` (scripts: `start`, `build`, `test`).
- Main app: `src/App.js` and `src/App.css`.
- Project README: `README.md` (CRA guidance and commands).

7) Notes for maintainers
- Repository currently looks like a direct CRA scaffold and may be a placeholder; confirm whether the nested `loan-intake-frontend/` copy is intended to be a subpackage or accidental duplication.

If anything here is unclear or you want the instructions tuned to a preferred working folder (root vs nested), tell me which folder to target and I will iterate.
