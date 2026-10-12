import { test } from 'node:test';
import assert from 'node:assert/strict';
import { column, generate, getGroups, MAX_SIZE, MIN_SIZE } from '../public/js/nonogram.js';

test('same seed and size give the same puzzle', () => {
  assert.deepEqual(generate('abc', 10), generate('abc', 10));
  assert.notDeepEqual(generate('abc', 10).solution, generate('abd', 10).solution);
});

test('clues match the solution and no line is empty', () => {
  for (const size of [5, 10, 15, 30]) {
    for (let n = 0; n < 20; n++) {
      const p = generate(`seed${n}`, size);
      assert.equal(p.solution.length, size);
      p.solution.forEach((row, r) => {
        assert.equal(row.length, size);
        assert.deepEqual(getGroups(row), p.rowClues[r]);
        assert.ok(row.includes(1));
      });
      for (let c = 0; c < size; c++) {
        assert.deepEqual(getGroups(column(p.solution, c)), p.colClues[c]);
        assert.ok(column(p.solution, c).includes(1));
      }
    }
  }
});

test('size is clamped', () => {
  assert.equal(generate('x', 1).size, MIN_SIZE);
  assert.equal(generate('x', 999).size, MAX_SIZE);
});

test('getGroups', () => {
  assert.deepEqual(getGroups([0, 0, 0]), [0]);
  assert.deepEqual(getGroups([1, 1, 0, 1, 0, 1, 1, 1]), [2, 1, 3]);
});
