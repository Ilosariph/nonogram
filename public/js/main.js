import { arrEq, column, generate, getGroups, MAX_SIZE, randomSeed } from './nonogram.js';

// Dark mode
const darkToggle = document.getElementById('darkToggle');
function applyDark(on) {
  document.documentElement.classList.toggle('dark', on);
  darkToggle.textContent = on ? '☀' : '☾';
  localStorage.setItem('dark', on ? '1' : '');
}
applyDark(localStorage.getItem('dark') === '1');
darkToggle.addEventListener('click', () => applyDark(!document.documentElement.classList.contains('dark')));

let puzzle = null;
let grid = [];
let mode = 'fill';
let solved = false;
let timerSec = 0;
let timerInterval = null;
let painting = null;
let dragStart = null;
let dragDir = null; // 'row' | 'col' | null
let dragLast = null; // index along drag axis of last painted cell
let pendingTap = false; // drag started on a non-empty cell; toggle it on release if no drag
let livesMode = true;
let lives = 3;
let solution = null;
let livesAnimating = false;
let revealedCells = new Set();

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

$('#newBtn').addEventListener('click', () => { $('#seedInput').value = ''; loadPuzzle(); });
$('#retryBtn').addEventListener('click', () => { if (puzzle) { $('#seedInput').value = puzzle.seed; } loadPuzzle(); });
$('#seedInput').addEventListener('keydown', e => { if (e.key === 'Enter') loadPuzzle(); });

$('#sizeSelect').addEventListener('change', () => {
  const custom = $('#sizeSelect').value === 'custom';
  $('#customSize').style.display = custom ? '' : 'none';
  if (custom) $('#customSize').focus();
});
$('#customSize').addEventListener('keydown', e => { if (e.key === 'Enter') loadPuzzle(); });

function toggleMode() {
  mode = mode === 'fill' ? 'mark' : 'fill';
  $('#modeSlider').dataset.mode = mode;
}
$('#modeSlider').addEventListener('click', toggleMode);

function updateHeartsDisplay() {
  const html = [0, 1, 2].map(i =>
    `<span class="${i < lives ? '' : 'heart-lost'}">&#9829;</span>`
  ).join('');
  [$('#heartsDisplay'), $('#heartsDisplayMobile')].forEach(el => {
    if (!livesMode) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.innerHTML = html;
  });
}

function checkLivesMove(r, c, intendedValue) {
  if (!livesMode || !solution) return true;
  if (livesAnimating) return false;
  if (revealedCells.has(`${r},${c}`)) return true;
  if (grid[r][c] !== 0) return true;
  const wrong =
    (mode === 'fill' && intendedValue === 1 && solution[r][c] === 0) ||
    (mode === 'mark' && intendedValue === 2 && solution[r][c] === 1);
  if (!wrong) return true;
  triggerWrongMove(r, c);
  return false;
}

function triggerWrongMove(r, c) {
  livesAnimating = true;
  const td = document.querySelector(`td.cell[data-r="${r}"][data-c="${c}"]`);
  if (td) td.classList.add('cell-error');
  $('#puzzleWrap').classList.add('puzzle-shake');
  lives = Math.max(0, lives - 1);
  updateHeartsDisplay();
  setTimeout(() => {
    if (td) { td.classList.remove('cell-error'); void td.offsetWidth; }
    $('#puzzleWrap').classList.remove('puzzle-shake');
    const correct = solution[r][c] === 1 ? 1 : 2;
    grid[r][c] = correct;
    revealedCells.add(`${r},${c}`);
    refreshCell(r, c);
    updateClues();
    livesAnimating = false;
    if (lives === 0) {
      setTimeout(showGameOverModal, 150);
    } else {
      checkWin();
    }
  }, 600);
}

function showGameOverModal() {
  clearInterval(timerInterval);
  $('#gameOverSeedInfo').textContent = `seed: ${puzzle.seed}`;
  $('#gameOverModal').style.display = 'flex';
}

function hideGameOverModal() {
  $('#gameOverModal').style.display = 'none';
}

function scalePuzzle() {
  const wrap = document.getElementById('puzzleWrap');
  const scaler = wrap.querySelector('.puzzle-scaler');
  if (!scaler) return;
  scaler.style.transform = '';
  const tableW = scaler.scrollWidth;
  const tableH = scaler.scrollHeight;
  const style = getComputedStyle(wrap);
  const padH = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const available = wrap.clientWidth - padH;
  if (tableW > available) {
    const ratio = available / tableW;
    scaler.style.transformOrigin = 'top center';
    scaler.style.transform = `scale(${ratio})`;
    scaler.style.marginBottom = `-${tableH * (1 - ratio)}px`;
  } else {
    scaler.style.transform = '';
    scaler.style.marginBottom = '';
  }
}

window.addEventListener('resize', scalePuzzle);

function loadPuzzle() {
  solved = false;
  livesAnimating = false;
  lives = 3;
  revealedCells = new Set();
  $('#winBanner').classList.remove('show');
  hideGameOverModal();
  const seed = $('#seedInput').value.trim() || randomSeed();
  const sizeRaw = $('#sizeSelect').value;
  const size = sizeRaw === 'custom'
    ? Math.min(MAX_SIZE, Math.max(15, parseInt($('#customSize').value) || 20))
    : parseInt(sizeRaw);
  puzzle = generate(seed, size);
  solution = puzzle.solution;
  grid = Array.from({ length: puzzle.size }, () => Array(puzzle.size).fill(0));
  $('#seedInput').value = puzzle.seed;
  $('#seedDisplay').innerHTML = `seed: <code></code> &middot; ${puzzle.size}&times;${puzzle.size}`;
  $('#seedDisplay code').textContent = puzzle.seed;
  startTimer();
  renderPuzzle();
  updateClues();
  updateHeartsDisplay();
}

function startTimer() {
  clearInterval(timerInterval);
  timerSec = 0;
  $('#timerDisplay').textContent = '0:00';
  timerInterval = setInterval(() => {
    if (solved) return;
    timerSec++;
    const m = Math.floor(timerSec / 60);
    const s = (timerSec % 60).toString().padStart(2, '0');
    $('#timerDisplay').textContent = `${m}:${s}`;
  }, 1000);
}

function renderPuzzle() {
  const size = puzzle.size;
  const maxRowClueLen = Math.max(...puzzle.rowClues.map(c => c.length));
  const maxColClueLen = Math.max(...puzzle.colClues.map(c => c.length));

  let html = '<table class="puzzle-table">';

  for (let ci = 0; ci < maxColClueLen; ci++) {
    html += '<tr>';
    html += `<td colspan="${maxRowClueLen}" style="border:none"></td>`;
    for (let c = 0; c < size; c++) {
      const clues = puzzle.colClues[c];
      const offset = maxColClueLen - clues.length;
      const idx = ci - offset;
      const val = idx >= 0 ? clues[idx] : '';
      const id = idx >= 0 ? `data-clue-id="c${c}-${idx}"` : '';
      html += `<td class="col-clue-cell"><div class="col-clue-inner"><span class="clue-num" ${id}>${val}</span></div></td>`;
    }
    html += '</tr>';
  }

  for (let r = 0; r < size; r++) {
    html += '<tr>';
    const rc = puzzle.rowClues[r];
    const nums = rc.map((v, i) => `<span class="clue-num" data-clue-id="r${r}-${i}">${v}</span>`).join('');
    html += `<td class="row-clue-cell" colspan="${maxRowClueLen}"><div class="row-clue-inner">${nums}</div></td>`;
    for (let c = 0; c < size; c++) {
      let cls = 'cell';
      if (c === 0 || (c % 5 === 0 && c > 0)) cls += ' thick-left';
      if (r === 0 || (r % 5 === 0 && r > 0)) cls += ' thick-top';
      if (c === size - 1) cls += ' thick-right';
      if (r === size - 1) cls += ' thick-bottom';
      html += `<td class="${cls}" data-r="${r}" data-c="${c}"></td>`;
    }
    html += '</tr>';
  }

  html += '</table>';
  $('#puzzleWrap').innerHTML = `<div class="puzzle-scaler">${html}</div>`;
  scalePuzzle();
  bindCells();
}

function endDrag() { painting = null; dragStart = null; dragDir = null; dragLast = null; pendingTap = false; }
document.addEventListener('pointerup', () => {
  // Press on a non-empty cell without dragging acts as a normal tap.
  if (pendingTap && dragDir === null && !solved) toggleCell(dragStart.r, dragStart.c);
  endDrag();
});
document.addEventListener('pointercancel', endDrag);
document.addEventListener('pointermove', onDocPointerMove);
// iOS Safari can ignore touch-action on table cells; block scroll/pull-to-refresh while painting.
document.addEventListener('touchmove', e => { if (painting !== null) e.preventDefault(); }, { passive: false });

function bindCells() {
  $$('td.cell').forEach(td => {
    td.addEventListener('pointerdown', onPointerDown);
  });
}

// Index of the cell along the drag axis nearest to the pointer.
function nearestIndex(cells, pos, axis) {
  let best = -1, bestDist = Infinity;
  cells.forEach((td, i) => {
    const rect = td.getBoundingClientRect();
    const mid = axis === 'row' ? (rect.left + rect.right) / 2 : (rect.top + rect.bottom) / 2;
    const dist = Math.abs(pos - mid);
    if (dist < bestDist) { bestDist = dist; best = i; }
  });
  return best;
}

function onDocPointerMove(e) {
  if (painting === null || solved || dragStart === null) return;
  if (dragDir === null) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || !el.classList.contains('cell')) return;
    const dr = Math.abs(+el.dataset.r - dragStart.r);
    const dc = Math.abs(+el.dataset.c - dragStart.c);
    if (dr === 0 && dc === 0) return;
    dragDir = dc >= dr ? 'row' : 'col';
    dragLast = dragDir === 'row' ? dragStart.c : dragStart.r;
  }
  const cells = Array.from(dragDir === 'row'
    ? document.querySelectorAll(`td.cell[data-r="${dragStart.r}"]`)
    : document.querySelectorAll(`td.cell[data-c="${dragStart.c}"]`));
  if (!cells.length) return;
  const target = nearestIndex(cells, dragDir === 'row' ? e.clientX : e.clientY, dragDir);
  if (target < 0 || target === dragLast) return;
  // Fill every cell between the last painted one and the target so fast drags don't skip cells.
  const step = target > dragLast ? 1 : -1;
  for (let i = dragLast + step; ; i += step) {
    const ok = dragDir === 'row' ? applyCell(dragStart.r, i, painting) : applyCell(i, dragStart.c, painting);
    if (!ok) break;
    dragLast = i;
    if (i === target) break;
  }
}

function onPointerDown(e) {
  if (solved || (livesMode && lives === 0)) return;
  e.preventDefault();
  const r = +e.currentTarget.dataset.r;
  const c = +e.currentTarget.dataset.c;
  if (grid[r][c] !== 0) {
    // Defer: a tap toggles this cell on release, a drag leaves it and paints empty cells.
    painting = mode === 'fill' ? 1 : 2;
    pendingTap = true;
  } else {
    painting = toggleCell(r, c);
    pendingTap = false;
  }
  dragStart = { r, c };
  dragDir = null;
  dragLast = null;
  e.currentTarget.setPointerCapture?.(e.pointerId);
  e.currentTarget.releasePointerCapture?.(e.pointerId);
}

function toggleCell(r, c) {
  const current = grid[r][c];
  let next;
  if (mode === 'fill') { next = current === 1 ? 0 : 1; }
  else { next = current === 2 ? 0 : 2; }
  if (livesMode && current !== 0) return null;
  if (!checkLivesMove(r, c, next)) return null;
  grid[r][c] = next;
  refreshCell(r, c);
  updateClues();
  checkWin();
  return next;
}

function applyCell(r, c, value) {
  if (livesMode && grid[r][c] !== 0) return true;
  if (grid[r][c] === value) return true;
  if (mode === 'fill' && value !== 0 && value !== 1) return true;
  if (mode === 'mark' && value !== 0 && value !== 2) return true;
  if (value !== 0 && grid[r][c] !== 0) return true;
  if (!checkLivesMove(r, c, value)) return false;
  grid[r][c] = value;
  refreshCell(r, c);
  updateClues();
  checkWin();
  return true;
}

function refreshCell(r, c) {
  const td = document.querySelector(`td.cell[data-r="${r}"][data-c="${c}"]`);
  if (!td) return;
  td.classList.toggle('filled', grid[r][c] === 1);
  td.classList.toggle('marked', grid[r][c] === 2);
}

function updateClues() {
  if (!puzzle) return;
  const size = puzzle.size;
  for (let r = 0; r < size; r++) {
    const done = arrEq(getGroups(grid[r]), puzzle.rowClues[r]);
    for (let i = 0; i < puzzle.rowClues[r].length; i++) {
      const el = document.querySelector(`[data-clue-id="r${r}-${i}"]`);
      if (el) el.classList.toggle('done', done);
    }
    if (done && livesMode) autoMarkRow(r);
  }
  for (let c = 0; c < size; c++) {
    const done = arrEq(getGroups(column(grid, c)), puzzle.colClues[c]);
    for (let i = 0; i < puzzle.colClues[c].length; i++) {
      const el = document.querySelector(`[data-clue-id="c${c}-${i}"]`);
      if (el) el.classList.toggle('done', done);
    }
    if (done && livesMode) autoMarkCol(c);
  }
}

function autoMarkRow(r) {
  for (let c = 0; c < puzzle.size; c++) {
    if (grid[r][c] === 0) {
      grid[r][c] = 2;
      refreshCell(r, c);
    }
  }
}

function autoMarkCol(c) {
  for (let r = 0; r < puzzle.size; r++) {
    if (grid[r][c] === 0) {
      grid[r][c] = 2;
      refreshCell(r, c);
    }
  }
}

// Any grid matching every clue is a valid solution, even if it differs from the generated one.
function isSolved() {
  return puzzle.rowClues.every((clues, r) => arrEq(getGroups(grid[r]), clues))
    && puzzle.colClues.every((clues, c) => arrEq(getGroups(column(grid, c)), clues));
}

function checkWin() {
  if (solved || !isSolved()) return;
  solved = true;
  clearInterval(timerInterval);
  for (let r = 0; r < puzzle.size; r++) {
    for (let c = 0; c < puzzle.size; c++) {
      if (grid[r][c] === 0) { grid[r][c] = 2; refreshCell(r, c); }
    }
  }
  $('#winBanner').classList.add('show');
  launchConfetti();
}

function setMode(m) {
  mode = m;
  $('#modeSlider').dataset.mode = mode;
}

$('#markDoneRowsBtn').addEventListener('click', () => {
  if (!puzzle || solved) return;
  const size = puzzle.size;
  for (let r = 0; r < size; r++) {
    if (!arrEq(getGroups(grid[r]), puzzle.rowClues[r])) continue;
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === 0) { grid[r][c] = 2; refreshCell(r, c); }
    }
  }
  for (let c = 0; c < size; c++) {
    if (!arrEq(getGroups(column(grid, c)), puzzle.colClues[c])) continue;
    for (let r = 0; r < size; r++) {
      if (grid[r][c] === 0) { grid[r][c] = 2; refreshCell(r, c); }
    }
  }
  updateClues();
  checkWin();
});

document.addEventListener('keydown', e => {
  if (e.key === 'f' || e.key === 'F') setMode('fill');
  else if (e.key === 'x' || e.key === 'X') setMode('mark');
});

const settingsPanel = $('#settingsPanel');
$('#settingsBtn').addEventListener('click', e => {
  e.stopPropagation();
  settingsPanel.style.display = settingsPanel.style.display === 'none' ? '' : 'none';
});
document.addEventListener('click', () => { settingsPanel.style.display = 'none'; });
settingsPanel.addEventListener('click', e => e.stopPropagation());

function setLivesMode(on) {
  livesMode = on;
  $('#livesModeItem').classList.toggle('active', livesMode);
  $('#standardModeItem').classList.toggle('active', !livesMode);
  loadPuzzle();
}
$('#livesModeItem').addEventListener('click', () => setLivesMode(true));
$('#standardModeItem').addEventListener('click', () => setLivesMode(false));

$('#goRetryBtn').addEventListener('click', () => {
  hideGameOverModal();
  if (puzzle) $('#seedInput').value = puzzle.seed;
  loadPuzzle();
});

$('#goNewBtn').addEventListener('click', () => {
  hideGameOverModal();
  $('#seedInput').value = '';
  loadPuzzle();
});

function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const W = canvas.width;
  const H = canvas.height;

  const COLORS = ['#c45d3e','#2c2826','#f5c842','#6a9e6a','#5b8fc9','#c47db8'];
  const COUNT = 300;
  const DURATION = 3500;
  const start = performance.now();

  const particles = Array.from({ length: COUNT }, () => ({
    x: Math.random() * W,
    y: H + Math.random() * 20,
    vx: (Math.random() - 0.5) * 8,
    vy: -(Math.random() * 18 + 8),
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.3,
    w: Math.random() * 10 + 5,
    h: Math.random() * 5 + 3,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));

  function draw(now) {
    const elapsed = now - start;
    if (elapsed > DURATION) { ctx.clearRect(0, 0, W, H); return; }
    const progress = elapsed / DURATION;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = 1 - Math.pow(progress, 2);
    for (const p of particles) {
      p.x += p.vx;
      p.vy += 0.18;
      p.y += p.vy;
      p.angle += p.spin;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}

loadPuzzle();
