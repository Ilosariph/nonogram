# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running

- `npm start` — static server at http://localhost:8000 (python3 http.server on `public/`).
- `npm test` — generator tests via `node --test` (no dependencies).
- `docker compose up` — nginx serving `public/` on port 5000.

## Architecture

Static site, no backend, no build step:

- **`public/js/nonogram.js`** — pure logic: `generate(seed, size)` (deterministic via FNV-hashed seed + mulberry32), `getGroups`, `column`, `arrEq`.
- **`public/js/main.js`** — all UI/game code (ES module).
- **`public/index.html`**, **`public/styles.css`** — markup and styles.

**Key design decisions:**
- Same seed + size always produces the same puzzle.
- Generation OR-blends a row-biased and a column-biased random pass, then ensures no empty rows/columns.
- Win = every row/column clue satisfied (any valid solution counts). Lives mode checks each move against the generated solution.

**Frontend state (module globals in main.js):**
- `grid[r][c]` — `0`=empty, `1`=filled, `2`=marked
- `mode` — `"fill"` or `"mark"`
- `puzzle` — `{ seed, size, rowClues, colClues, solution }`
- `solved` — win flag; `timerSec` — elapsed seconds
