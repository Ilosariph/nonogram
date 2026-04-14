# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Application

**Local development:**
```bash
python app.py
```
Starts Flask dev server at http://localhost:5000.

**Docker:**
```bash
docker-compose up
```
Runs with Gunicorn (2 workers) at port 5000.

**Install dependencies:**
```bash
pip install flask gunicorn
```

## Architecture

This is a minimal two-file Flask nonogram puzzle game:

- **`app.py`** — Flask backend with two endpoints:
  - `GET /api/puzzle?seed=<str>&size=<int>` — Generates a deterministic puzzle from a SHA256-hashed seed. Returns row/column clues and a solution hash (never the raw solution).
  - `POST /api/check` — Validates the player's submitted grid by regenerating the puzzle server-side and comparing.
- **`templates/index.html`** — The entire frontend: HTML structure, all CSS, and all game JavaScript in one file (~565 lines).

**Key design decisions:**
- Puzzle generation is deterministic: same seed + size always produces the same puzzle.
- The solution is never sent to the client; the server re-generates it on each `/api/check` call.
- Fill density targets 40–55% to keep puzzles solvable; generation retries until no empty rows/columns exist.
- Frontend validates clues locally (strike-through on completion) but the authoritative win check is server-side.

**Frontend state (all in JS globals):**
- `grid[r][c]` — `0`=empty, `1`=filled, `2`=marked
- `mode` — `"fill"` or `"mark"`
- `puzzle` — current puzzle metadata (clues, size, seed)
- `solved` — win flag; `timerSec` — elapsed seconds
