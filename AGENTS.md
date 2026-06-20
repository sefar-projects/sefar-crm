# AGENTS.md

## Project Snapshot
- Vite + React app with Tailwind styling and Supabase as the backend.
- The main flow is in [src/App.jsx](src/App.jsx) and the visa workflow editor is in [src/components/VisaSteps.jsx](src/components/VisaSteps.jsx).
- The UI is Arabic and RTL by default; preserve that direction and wording when editing screens.

## Working Rules
- Keep changes small and focused; prefer fixing the local behavior in the owning component over broad refactors.
- Preserve the current Tailwind utility style and component structure unless a change requires otherwise.
- Treat Supabase writes carefully: update local state and database state together in the visa workflow.
- Do not introduce TypeScript, new state libraries, or routing changes unless explicitly requested.
- Use the existing field names and table shape expected by the Supabase queries in [src/App.jsx](src/App.jsx) and [src/components/VisaSteps.jsx](src/components/VisaSteps.jsx).

## Environment
- Required env vars: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Keep the app compatible with the current Vite setup in [package.json](package.json) and [eslint.config.js](eslint.config.js).

## Commands
- Install deps: `npm install`
- Dev server: `npm run dev`
- Lint: `npm run lint`
- Production build: `npm run build`

## Validation
- Prefer `npm run lint` for JavaScript and React-hook checks after edits.
- Run `npm run build` when changes affect app flow, environment variables, or component composition.

## Reference
- See [README.md](README.md) for the baseline Vite template context.