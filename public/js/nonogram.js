// Pure nonogram logic: seeded puzzle generation and clue computation.
// Grids are arrays of rows; cells are 1 = filled, 0 = empty.

export const MIN_SIZE = 5;
export const MAX_SIZE = 50;

// Hashes a seed string into a 32-bit integer (FNV-1a + final avalanche).
export function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return h >>> 0;
}

// Small seedable PRNG so the same seed always yields the same puzzle.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed() {
  return Math.floor(Math.random() * 0x100000000).toString(16);
}

// Run lengths of filled cells in a line; [0] for a line with none.
export function getGroups(line) {
  const groups = [];
  let count = 0;
  for (const v of line) {
    if (v === 1) count++;
    else if (count > 0) { groups.push(count); count = 0; }
  }
  if (count > 0) groups.push(count);
  return groups.length ? groups : [0];
}

export const column = (grid, c) => grid.map((row) => row[c]);

export function arrEq(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// Generates a puzzle deterministically from (seed, size).
export function generate(seed, size = 10) {
  size = Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.floor(size) || 10));
  const rng = mulberry32(hashSeed(`${seed}:${size}`));
  const randInt = (n) => Math.floor(rng() * n);

  // ~40-55% fill, biased toward runs so clues stay interesting.
  const density = 0.40 + rng() * 0.15;
  const makeLine = () => {
    const line = [];
    let prev = 0;
    for (let i = 0; i < size; i++) {
      const p = prev ? Math.min(0.75, density * 1.6) : density * 0.8;
      prev = rng() < p ? 1 : 0;
      line.push(prev);
    }
    return line;
  };

  // OR-blend a row-biased pass with a column-biased pass.
  const rows = Array.from({ length: size }, makeLine);
  const colsT = Array.from({ length: size }, makeLine);
  const solution = rows.map((row, r) => row.map((v, c) => (v || colsT[c][r] ? 1 : 0)));

  // No completely empty rows/columns (boring clues).
  for (let r = 0; r < size; r++) {
    if (!solution[r].includes(1)) solution[r][randInt(size)] = 1;
  }
  for (let c = 0; c < size; c++) {
    if (!column(solution, c).includes(1)) solution[randInt(size)][c] = 1;
  }

  return {
    seed,
    size,
    rowClues: solution.map(getGroups),
    colClues: solution.map((_, c) => getGroups(column(solution, c))),
    solution,
  };
}
