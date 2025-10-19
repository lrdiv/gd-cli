# gdcli

A TypeScript CLI for exploring Grateful Dead recordings on archive.org. It uses `commander` for argument parsing, `chalk` for colorful output, `ora` for spinners, `inquirer` for prompts, and `execa` for environment inspection.

## Quick start
1. Install dependencies: `npm install`
2. Run the CLI in watch mode: `npm run dev -- shows 1977-05-08`
3. Build the distributable: `npm run build`
4. Execute the bundled CLI: `node dist/cli.js shows 1977-05-08 --auto`

## Commands
- `shows <date>` — Fetches all recordings from the supplied `YYYY-MM-DD` calendar date (any year) and lets you pick one to open in your browser.
  - `-a, --auto` — Automatically open the top-rated recording without prompting.
- `today` — Looks up recordings that happened on today's month/day across all years.
  - `-a, --auto` — Automatically open the top-rated recording without prompting.
- `info` — Prints Node, npm, and git versions using `execa`.

The CLI also accepts a global `-v, --verbose` flag, reserved for future logging.

## Development scripts
- `npm run dev -- <args>` — Run the TypeScript entry point with hot reloading via `tsx`.
- `npm run build` — Bundle the CLI with `tsup`, emitting ESM output and type declarations under `dist/`.
- `npm run typecheck` — Run `tsc --noEmit` to ensure the codebase is type-safe.

## Manual verification
- Interactive flow: `npm run dev -- shows 1977-05-08`
- Non-interactive flow: `npm run dev -- today --auto`
- Environment info: `npm run dev -- info`
