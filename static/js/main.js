'use strict';

/* ==========================================================================
   STOPWATCH STATE & CORE ELEMS
   ========================================================================== */
let timerInterval = null;
let running = false;
let startTime = 0;
let elapsed = 0;
let selectedLang = 'C';
let globalLeaderboardCache = []; // Local cache to allow dynamic sub-filtering without slamming network queries

const timerDisplay = document.getElementById('timer-display');
const statusText = document.getElementById('status-text');
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop-timer');
const modal = document.getElementById('result-modal');
const resultForm = document.getElementById('result-form');

const btnC  = document.getElementById('btn-c');
const btnPy = document.getElementById('btn-py');

/**
 * Transforms millisecond increments into standard readable layout (M:SS.hh)
 */
function msToDisplay(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const cs = Math.floor((ms % 1000) / 10);
  
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function startTimer() {
  if (running) return;
  running = true;
  elapsed = 0;
  startTime = Date.now();
  
  btnStart.disabled = true;
  btnStop.disabled = false;
  
  timerInterval = setInterval(() => {
    elapsed = Date.now() - startTime;
    timerDisplay.textContent = msToDisplay(elapsed);
  }, 10);
  
  if (statusText) statusText.textContent = 'Timer running...';
}

function stopTimer() {
  if (!running) return;
  running = false;
  clearInterval(timerInterval);
  
  btnStart.disabled = false;
  btnStop.disabled = true;
  
  if (statusText) statusText.textContent = 'Enter details to save';
  
  // Bind run variables inside modal components
  document.getElementById('result-time').value = msToDisplay(elapsed);
  document.getElementById('result-lang').value = selectedLang;
  document.getElementById('player-name').value = '';
  document.getElementById('question-no').value = '';
  
  modal.classList.add('active');
  document.getElementById('player-name').focus();
}

function resetTimer() {
  running = false;
  clearInterval(timerInterval);
  elapsed = 0;
  timerDisplay.textContent = '00:00.00';
  btnStart.disabled = false;
  btnStop.disabled = true;
  if (statusText) statusText.textContent = 'Ready';
  
  // Dispatches reset signal to the server backend database layout
  fetch('/api/reset', { method: 'POST' })
    .then(() => {
      // FIX: Wipe the local global storage array clean immediately
      globalLeaderboardCache = [];
      
      // Update both UI views to reflect the freshly wiped cache
      renderMasterBoard(globalLeaderboardCache);
      renderSubBoard(globalLeaderboardCache, selectedLang);
    })
    .catch(err => console.error('Error clearing remote storage:', err));
}

/* ==========================================================================
   MODAL CAPTURE & BACKEND SYNC
   ========================================================================== */
document.getElementById('btn-cancel').addEventListener('click', () => {
  modal.classList.remove('active');
  timerDisplay.textContent = '00:00.00';
  if (statusText) statusText.textContent = 'Ready';
  elapsed = 0;
});

// Modal mask target safety click-away layer rule
modal.querySelector('.modal-overlay')?.addEventListener('click', () => {
  modal.classList.remove('active');
});

resultForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const name = document.getElementById('player-name').value.trim();
  const questionNo = document.getElementById('question-no').value.trim();
  const lang = document.getElementById('result-lang').value;
  
  if (!name || !questionNo) {
    alert('Please fill in all fields');
    return;
  }
  
  try {
    const response = await fetch('/api/save-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name,
        question_no: questionNo,
        time_ms: elapsed,
        lang: lang
      })
    });
    
    const data = await response.json();
    
    if (data.status === 'ok') {
      modal.classList.remove('active');
      if (statusText) statusText.textContent = `Rank #${data.rank} - ${name}`;
      
      // Request updated server arrays
      refreshLeaderboard();
      
      // Cleanup timer tracking environment state
      timerDisplay.textContent = '00:00.00';
      elapsed = 0;
    } else {
      alert('Error saving result: ' + data.message);
    }
  } catch (err) {
    alert('Network transaction fault: ' + err.message);
  }
});

/* ==========================================================================
   LEADERBOARD RENDER MATRICES
   ========================================================================== */
/**
 * Renders both the master combined leaderboard AND the active language-specific leaderboard
 */
async function refreshLeaderboard() {
  try {
    const response = await fetch('/api/leaderboard');
    globalLeaderboardCache = await response.json();
    
    // 1. Process Master Combined Board
    renderMasterBoard(globalLeaderboardCache);
    
    // 2. Process Isolated Sub-Language Board
    renderSubBoard(globalLeaderboardCache, selectedLang);

  } catch (err) {
    console.error('Error rendering remote data matrices:', err);
  }
}

/**
 * Standard output generator targeting Master Global Layout Matrix
 */
function renderMasterBoard(data) {
  const container = document.getElementById('leaderboard-container');
  if (!container) return;
  container.innerHTML = '';
  
  data.forEach(entry => {
    const row = document.createElement('div');
    row.className = 'leaderboard-row' + (entry.rank === 1 ? ' rank-1' : '');
    
    row.innerHTML = `
      <span class="col-rank">${entry.rank === 1 ? '👑' : entry.rank}</span>
      <span class="col-name"></span>
      <span class="col-lang"></span>
      <span class="col-q"></span>
      <span class="col-time"></span>
    `;
    
    row.querySelector('.col-name').textContent = entry.name;
    row.querySelector('.col-lang').textContent = entry.lang;
    row.querySelector('.col-q').textContent = entry.question_no;
    row.querySelector('.col-time').textContent = entry.time;
    
    container.appendChild(row);
  });
}

/**
 * Dynamic filter generator targeting internal structural language selectors
 */
function renderSubBoard(data, languageFilter) {
  const subContainer = document.getElementById('sub-board-container') || document.getElementById('sub-leaderboard-container');
  if (!subContainer) return;
  subContainer.innerHTML = '';

  // Filter out any other execution targets, then re-index local rank arrays
  const filteredData = data.filter(entry => entry.lang.toLowerCase() === languageFilter.toLowerCase());

  filteredData.forEach((entry, index) => {
    const internalLanguageRank = index + 1;
    const row = document.createElement('div');
    row.className = 'leaderboard-row' + (internalLanguageRank === 1 ? ' rank-1' : '');

    row.innerHTML = `
      <span class="col-rank">${internalLanguageRank === 1 ? '👑' : internalLanguageRank}</span>
      <span class="col-name"></span>
      <span class="col-q"></span>
      <span class="col-time"></span>
    `;

    row.querySelector('.col-name').textContent = entry.name;
    row.querySelector('.col-q').textContent = entry.question_no;
    row.querySelector('.col-time').textContent = entry.time;

    subContainer.appendChild(row);
  });
}

/* ==========================================================================
   INTERACTION EVENTS & LANGUAGE SWITCHING
   ========================================================================== */
btnStart.addEventListener('click', startTimer);
btnStop.addEventListener('click', stopTimer);

document.getElementById('btn-reset').addEventListener('click', () => {
  if (confirm('Clear all leaderboard data?')) {
    resetTimer();
  }
});

// Consolidated Language Toggles (Duplicate removed)
if (btnC && btnPy) {
  btnC.addEventListener('click', () => {
    btnC.classList.add('active');
    btnPy.classList.remove('active');
    selectedLang = 'C';
    if (statusText) statusText.textContent = 'C Environment selected. Press START to run.';
    
    renderSubBoard(globalLeaderboardCache, 'C');
  });

  btnPy.addEventListener('click', () => {
    btnPy.classList.add('active');
    btnC.classList.remove('active');
    selectedLang = 'Python';
    if (statusText) statusText.textContent = 'Python Environment selected. Press START to run.';
    
    renderSubBoard(globalLeaderboardCache, 'Python');
  });
}

/* ==========================================================================
   SAFETY FALLBACK HOOKS (Optional/Safeguarded elements)
   ========================================================================== */
const btnBack = document.querySelector('.btn-back');
if (btnBack) {
  btnBack.addEventListener('click', () => {
    if (statusText) statusText.textContent = 'No previous history directory found.';
  });
}

const btnHeaderStop = document.getElementById('btn-stop');
if (btnHeaderStop) {
  btnHeaderStop.addEventListener('click', () => {
    if (running) stopTimer();
  });
}

// Initialise core elements on container load completion
document.addEventListener('DOMContentLoaded', () => {
  refreshLeaderboard();
});