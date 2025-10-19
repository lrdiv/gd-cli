# gdarchive

## `(~);}`

A TypeScript CLI for exploring Grateful Dead recordings on archive.org. It uses `commander` for argument parsing, `chalk` for colorful output, `ora` for spinners, `inquirer` for prompts, and `execa` for environment inspection.

## Run with npx

```bash
npx gdarchive today
```

## Quick start

1. Install dependencies: `npm install`
2. Run the CLI in watch mode: `npm run dev -- shows 1977-05-08`
3. Build the distributable: `npm run build`
4. Creare a global symlink: `npm link`

## Examples

Open the highest rated recording of a specific show:

```bash
gda shows 1977-05-08 --auto
```

Select from all historical shows played on a month and day:

```bash
gda shows 05-08
```

Select from historical shows played on today's date:

```bash
gda today
```

## Commands

- `shows <date>` — Fetches all recordings from the supplied `YYYY-MM-DD` calendar date (any year) and lets you pick one to open in your browser.
  - `-a, --auto` — Automatically open the top-rated recording without prompting.
- `today` — Looks up recordings that happened on today's month/day across all years.
  - `-a, --auto` — Automatically open the top-rated recording without prompting.

## Development scripts

- `npm run dev -- <args>` — Run the TypeScript entry point with hot reloading via `tsx`.
- `npm run build` — Bundle the CLI with `tsup`, emitting ESM output and type declarations under `dist/`.
- `npm run typecheck` — Run `tsc --noEmit` to ensure the codebase is type-safe.

## Manual verification

- Interactive flow: `npm run dev -- shows 1977-05-08`
- Non-interactive flow: `npm run dev -- today --auto`
- Environment info: `npm run dev -- info`
