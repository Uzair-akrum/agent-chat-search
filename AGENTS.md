# Repository Guidelines

## Project Structure & Module Organization
Core code lives in `src/`:
- `src/search.ts`: CLI entry point and option parsing.
- `src/readers/`: agent adapters (`claude.ts`, `kimi.ts`, `codex.ts`) plus shared reader logic in `base.ts`.
- `src/lib/`: shared search, parsing, snippet, formatting, and session-list utilities.
- `src/types.ts`: shared TypeScript types used across modules.

Tests are colocated with implementation as `*.test.ts` (for example, `src/lib/snippet.test.ts`). Usage examples live in `examples/`. Build artifacts are generated in `dist/`.

## Build, Test, and Development Commands
- `npm install`: install dependencies (Node 18+; CI uses Node 20).
- `npm run dev -- --query "auth" --all`: run CLI from source via `tsx`.
- `npm run build`: compile TypeScript into `dist/`.
- `npm start -- --query "auth" --all`: run compiled CLI.
- `npm test`: run Vitest test suite once.
- `npm run dev-test`: run Vitest in watch mode.
- `npm run check-format`: verify Prettier formatting.
- `npm run format`: apply Prettier formatting.
- `npm run ci`: local CI parity (`build + check-format + test`).

## Coding Style & Naming Conventions
TypeScript is configured with `strict: true`; keep types explicit and avoid `any` unless justified. Formatting is Prettier-driven (`.prettierrc`): 2-space indent, single quotes, semicolons, trailing commas, 80-char print width. Use ES module imports with `.js` suffix for local imports (for example, `import { searchAgents } from './lib/search.js';`).

Match existing naming patterns: reader files by agent (`codex.ts`), utility files in kebab-case (`session-list.ts`), and mirrored test names (`session-list.test.ts`).

## Testing Guidelines
Use Vitest for unit tests. Add or update tests whenever behavior changes, especially for reader parsing and CLI option handling. Prefer isolated filesystem fixtures (temporary dirs) over real home-directory data. Run `npm test` and, for CLI-facing changes, a quick manual smoke test via `npm run dev -- --list-sessions --all`.

## Commit & Pull Request Guidelines
Recent history shows concise, imperative subjects with frequent Conventional Commit prefixes (`docs:`, `chore:`). Follow that style when possible (`feat: add literal search filter`). Keep PRs aligned with `.github/PULL_REQUEST_TEMPLATE.md`: clear description, change type, testing checklist, and linked issue (`Fixes #123`). Update docs (`README.md`, `SKILL.md`, `INSTALL.md`) when flags, behavior, or installation steps change.
