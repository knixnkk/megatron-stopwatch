'use strict';

/* ── CLOCK ── */
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  document.getElementById('foot-clock').textContent = `${h}:${m}:${s}`;
}
setInterval(updateClock, 1000);
updateClock();

/* ── STOPWATCH ── */
let timerInterval = null;
let running = false;
let startTime = 0;
let elapsed = 0;
let bestMs = null;

const timerDisplay = document.getElementById('timer-display');
const bestDisplay  = document.getElementById('best-display');
const statusCell   = document.getElementById('status-cell');
const inputCell    = document.getElementById('input-cell');

function msToDisplay(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const cs = Math.floor((ms % 1000) / 10);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function startTimer() {
  if (running) return;
  running = true;
  startTime = Date.now() - elapsed;
  timerInterval = setInterval(() => {
    elapsed = Date.now() - startTime;
    timerDisplay.textContent = msToDisplay(elapsed);
  }, 33);
  statusCell.textContent = 'MEGATRON_TIMER_RUNNING';
  inputCell.textContent  = 'Session active.';
}

function stopTimer() {
  if (!running) return;
  running = false;
  clearInterval(timerInterval);
  if (bestMs === null || elapsed < bestMs) {
    bestMs = elapsed;
    bestDisplay.textContent = msToDisplay(bestMs);
    flashEl(bestDisplay);
    statusCell.textContent = 'NEW_BEST_RECORDED';
    inputCell.textContent  = 'Personal best updated!';
  } else {
    statusCell.textContent = 'MEGATRON_TIMER_STOPPED';
    inputCell.textContent  = 'Press Select to restart.';
  }
}

function resetTimer() {
  running = false;
  clearInterval(timerInterval);
  elapsed = 0;
  timerDisplay.textContent = '0:00.00';
  statusCell.textContent   = 'MEGATRON_SYSTEM_READY';
  inputCell.textContent    = 'Select language to begin.';
  fetch('/api/reset', { method: 'POST' });
}

function flashEl(el) {
  el.classList.remove('flashing');
  void el.offsetWidth;
  el.classList.add('flashing');
  el.addEventListener('animationend', () => el.classList.remove('flashing'), { once: true });
}

/* ── BUTTONS ── */
document.getElementById('btn-stop').addEventListener('click', () => {
  if (running) stopTimer();
});

document.getElementById('btn-reset').addEventListener('click', () => {
  resetTimer();
});

document.getElementById('btn-select').addEventListener('click', () => {
  if (!running) {
    startTimer();
  } else {
    stopTimer();
  }
});

/* prev/next: cycle leaderboard highlight (visual only) */
const lbRows = document.querySelectorAll('.lb-row');
let activeRow = -1;

document.getElementById('btn-prev').addEventListener('click', () => {
  if (activeRow > 0) {
    lbRows[activeRow].style.outline = '';
    activeRow--;
  } else {
    if (activeRow !== -1) lbRows[activeRow].style.outline = '';
    activeRow = lbRows.length - 1;
  }
  lbRows[activeRow].style.outline = '2px solid #000';
  lbRows[activeRow].style.outlineOffset = '-2px';
});

document.getElementById('btn-next').addEventListener('click', () => {
  if (activeRow >= 0) lbRows[activeRow].style.outline = '';
  activeRow = (activeRow + 1) % lbRows.length;
  lbRows[activeRow].style.outline = '2px solid #000';
  lbRows[activeRow].style.outlineOffset = '-2px';
});

/* ── LANGUAGE TOGGLE ── */
const btnC  = document.getElementById('btn-c');
const btnPy = document.getElementById('btn-py');

btnC.addEventListener('click', () => {
  btnC.classList.add('btn-lang--active');
  btnPy.classList.remove('btn-lang--active');
  statusCell.textContent = 'LANG_SET__C';
  inputCell.textContent  = 'C selected. Press Select to begin.';
});

btnPy.addEventListener('click', () => {
  btnPy.classList.add('btn-lang--active');
  btnC.classList.remove('btn-lang--active');
  statusCell.textContent = 'LANG_SET__PYTHON';
  inputCell.textContent  = 'Python selected. Press Select to begin.';
});

/* ── BACK BUTTON ── */
document.querySelector('.btn-back').addEventListener('click', () => {
  statusCell.textContent = 'NAV_BACK_PRESSED';
  inputCell.textContent  = 'No previous page.';
});
