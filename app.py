from flask import Flask, render_template, jsonify, request
import random
import hashlib

app = Flask(__name__)


def generate_puzzle(seed: str, size: int = 5) -> dict:
    """Generate a nonogram puzzle from a seed string."""
    size = max(5, min(20, size))
    # Deterministic RNG from seed
    h = int(hashlib.sha256(seed.encode()).hexdigest(), 16)
    rng = random.Random(h)

    # Generate grid with ~40-55% fill rate, biased toward runs in both directions
    density = rng.uniform(0.40, 0.55)
    def make_line(n):
        line = []
        prev = 0
        for _ in range(n):
            # continuation raises chance of extending a run; slightly looser bias allows some singles
            p = min(0.75, density * 1.6) if prev else density * 0.8
            prev = 1 if rng.random() < p else 0
            line.append(prev)
        return line

    # Generate rows with run-biasing
    row_grid = [make_line(size) for _ in range(size)]
    # Generate columns with run-biasing, then transpose and average with row_grid
    col_grid_T = [make_line(size) for _ in range(size)]
    # Merge: cell is filled if either the row-pass or column-pass fills it (OR blend)
    grid = [[1 if row_grid[r][c] or col_grid_T[c][r] else 0
             for c in range(size)] for r in range(size)]

    # Ensure no completely empty rows/columns (boring clues)
    for r in range(size):
        if sum(grid[r]) == 0:
            grid[r][rng.randint(0, size - 1)] = 1
    for c in range(size):
        if sum(grid[r][c] for r in range(size)) == 0:
            grid[rng.randint(0, size - 1)][c] = 1

    def clues_for_line(line):
        groups = []
        count = 0
        for cell in line:
            if cell == 1:
                count += 1
            else:
                if count > 0:
                    groups.append(count)
                count = 0
        if count > 0:
            groups.append(count)
        return groups if groups else [0]

    row_clues = [clues_for_line(grid[r]) for r in range(size)]
    col_clues = [clues_for_line([grid[r][c] for r in range(size)]) for c in range(size)]

    return {
        "seed": seed,
        "size": size,
        "row_clues": row_clues,
        "col_clues": col_clues,
        "solution": grid,
    }


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/puzzle")
def puzzle():
    seed = request.args.get("seed", "")
    size = request.args.get("size", "5", type=int)
    lives_mode = request.args.get("lives", "0") == "1"
    if not seed:
        seed = hex(random.randint(0, 0xFFFFFFFF))[2:]
    data = generate_puzzle(seed, size)
    solution = data.pop("solution")
    if lives_mode:
        data["solution"] = solution
    else:
        flat = "".join(str(c) for row in solution for c in row)
        data["solution_hash"] = hashlib.sha256(flat.encode()).hexdigest()
    return jsonify(data)


@app.route("/api/check", methods=["POST"])
def check():
    body = request.get_json()
    seed = body.get("seed", "")
    size = body.get("size", 5)
    player_grid = body.get("grid", [])

    puzzle = generate_puzzle(seed, size)
    solution = puzzle["solution"]

    correct = player_grid == solution
    return jsonify({"correct": correct})


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
