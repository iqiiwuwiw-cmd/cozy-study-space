// room and sound controls
// saves data to browser storage

const store = {
  get(key, fallback = null) {
    try {
      const val = localStorage.getItem(key);
      if (val === null) return fallback;
      return JSON.parse(val);
    } catch (err) {
      // bad data in storage so use default
      return fallback;
    }
  },
  set(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (err) {
      // storage is full
    }
  }
};

const bus = {
  listeners: new Map(),
  on(event, fn) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(fn);
    return () => this.off(event, fn);
  },
  off(event, fn) {
    const set = this.listeners.get(event);
    if (set) set.delete(fn);
  },
  emit(event, payload) {
    const list = this.listeners.get(event);
    if (!list) return;
    for (const fn of list) {
      try {
        fn(payload);
      } catch (err) {
        console.error('bus listener error on ' + event + ':', err);
      }
    }
  }
};
window.cozyBus = bus;

const $ = id => document.getElementById(id);
const audioPlayer = $('audioPlayer');
const ambientPlayer = $('ambientPlayer');

if (audioPlayer) audioPlayer.volume = 0.5;
if (ambientPlayer) ambientPlayer.volume = 0.35;

let xp = +store.get('cozyXP', 0);
let level = +store.get('cozyLevel', 1);
let completedSessions = +store.get('cozySessions', 0);
let toastTimer = null;
let uploadedTracks = [];
let trackIdx = -1;
let ambientKind = null;

// save audio files in browser storage
let dbInstance = null;
async function getDb() {
  if (dbInstance) return dbInstance;
  if (typeof window === 'undefined' || !window.indexedDB) return null;

  return new Promise(resolve => {
    const req = window.indexedDB.open('cozy_audio_db', 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('tracks')) {
        db.createObjectStore('tracks', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => {
      dbInstance = req.result;
      resolve(dbInstance);
    };
    req.onerror = () => resolve(null);
  });
}

async function saveTrackToDb(name, blob) {
  const db = await getDb();
  if (!db) return null;
  return new Promise(resolve => {
    try {
      const tx = db.transaction('tracks', 'readwrite');
      const req = tx.objectStore('tracks').add({ name, blob, date: Date.now() });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch (err) {
      console.warn('could not save audio blob to indexeddb', err);
      resolve(null);
    }
  });
}

async function loadTracksFromDb() {
  const db = await getDb();
  if (!db) return;
  try {
    const tx = db.transaction('tracks', 'readonly');
    const req = tx.objectStore('tracks').getAll();
    req.onsuccess = () => {
      const items = req.result || [];
      for (let i = 0; i < items.length; i++) {
        const itm = items[i];
        uploadedTracks.push({
          id: itm.id,
          name: itm.name,
          url: URL.createObjectURL(itm.blob)
        });
      }
      renderUploadedTracks();
    };
  } catch (err) {
    console.warn('could not load custom audio from indexeddb', err);
  }
}

async function deleteTrackFromDb(id) {
  const db = await getDb();
  if (!db) return;
  try {
    db.transaction('tracks', 'readwrite').objectStore('tracks').delete(id);
  } catch (err) {
    console.warn('could not remove track from db', err);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

// check web address has http or https
function sanitizeUrl(raw) {
  if (!raw || raw === '#') return '';
  try {
    const u = new URL(raw, window.location.href);
    return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : '';
  } catch {
    return '';
  }
}

function enterRoom(target) {
  const landing = $('landingPage');
  const room = $('roomPage');
  if (landing) landing.classList.add('hidden');
  if (room) room.classList.remove('hidden');

  applyTheme(store.get('cozyTheme', 'sakura-morning'));
  if (audioPlayer && audioPlayer.paused) {
    playMusic();
  }
  if (target) {
    // wait a bit for layout before scroll
    setTimeout(() => {
      const el = document.querySelector(target);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }
}

function leaveRoom() {
  const room = $('roomPage');
  const landing = $('landingPage');
  if (room) room.classList.add('hidden');
  if (landing) landing.classList.remove('hidden');

  for (let i = 0; i < availableThemes.length; i++) {
    document.body.classList.remove(availableThemes[i]);
  }
  document.body.classList.add('sakura-morning');

  const preview = $('previewImg');
  if (preview) preview.src = themePreviewMap['sakura-morning'];
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const CAT_MOODS = {
  excited: 'assets/images/catexcited.gif',
  sleep: 'assets/images/catsleep.gif',
  blink: 'assets/images/catblink.gif'
};

function setCatMood(mood) {
  const cat = $('pixelCat');
  if (cat && CAT_MOODS[mood]) cat.src = CAT_MOODS[mood];
}

// TODO: add cooldown or daily cap on cat petting xp so clicking fast does not power level
function petCat() {
  bus.emit('xp:add', 5);
  setCatMood('excited');

  const msgs = [
    "purr... you're doing great! 🐾",
    'meow! proud of you for studying!',
    'soft paws, calm mind ☁️',
    'keep going, one step at a time.',
    '*happy tail wiggle* 🐱'
  ];
  const idx = Math.floor(Math.random() * msgs.length);
  showCatBubble(msgs[idx]);
}

function showCatBubble(msg) {
  const box = $('catSpeech');
  if (!box) return;
  box.textContent = msg;
  box.classList.remove('hidden');
  box.classList.add('show');
  setCatMood('excited');

  setTimeout(() => {
    box.classList.remove('show');
    setTimeout(() => {
      box.classList.add('hidden');
      setCatMood('blink');
    }, 300);
  }, 2200);
}

function showCelebration(msg) {
  const banner = $('celebrationBanner');
  const text = $('celebrationText');
  if (!banner || !text) return;

  text.textContent = msg;
  banner.classList.remove('hidden');
  banner.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    banner.classList.remove('show');
    setTimeout(() => banner.classList.add('hidden'), 350);
  }, 3000);
}

function updateProgress() {
  const xpEl = $('xp') || $('currentXP');
  const bar = $('xpFill') || $('xpProgressBar');
  const lvlEl = $('level') || $('currentLevel');

  if (xpEl) xpEl.textContent = xp;
  if (lvlEl) lvlEl.textContent = level;
  if (bar) bar.style.width = Math.min(100, xp) + '%';

  const achEl = $('achievement');
  if (achEl) {
    let title = 'Study Novice 🌱';
    if (level >= 10) title = 'Cosmic Scholar 🌌';
    else if (level >= 5) title = 'Focus Master ⭐';
    else if (level >= 3) title = 'Dedicated Learner 📚';
    else if (level >= 2) title = 'Curious Explorer 🌿';
    achEl.textContent = 'achievement: ' + title;
  }
}

// TODO: calculate multi level jumps directly instead of looping while xp >= 100
function addXP(n) {
  xp += n;
  while (xp >= 100) {
    xp -= 100;
    level++;
    showCelebration('Level ' + level + ' reached! ⭐');
    setCatMood('excited');
  }
  store.set('cozyXP', xp);
  store.set('cozyLevel', level);
  updateProgress();
}

const TRACKS = {
  lofi: 'assets/sounds/lofi.mp3',
  rain: 'assets/sounds/rain.mp3',
  cafe: 'assets/sounds/cafe.mp3',
  fireplace: 'assets/sounds/rain.mp3',
  birds: 'assets/sounds/birds.mp3'
};

const SOUND_NAMES = {
  lofi: 'Lo-fi Focus',
  rain: 'Rainy Window',
  cafe: 'Cozy Cafe',
  fireplace: 'Gentle Hearth',
  birds: 'Morning Birds'
};

function playMusic() {
  if (!audioPlayer) return;
  audioPlayer.play().then(() => {
    $('playIcon')?.classList.add('hidden');
    $('pauseIcon')?.classList.remove('hidden');
  }).catch(err => {
    // wait for first user click before playing audio
  });
}

function pauseMusic() {
  if (!audioPlayer) return;
  audioPlayer.pause();
  $('playIcon')?.classList.remove('hidden');
  $('pauseIcon')?.classList.add('hidden');
}

function togglePlay() {
  if (!audioPlayer) return;
  if (audioPlayer.paused) {
    playMusic();
  } else {
    pauseMusic();
  }
}

// TODO: unify setVolume (0-100) and changeVolume (0-1) so there is only one volume helper
function setVolume(val) {
  if (audioPlayer) {
    audioPlayer.volume = Math.max(0, Math.min(1, val / 100));
  }
}

function changeVolume(val) {
  if (audioPlayer) {
    audioPlayer.volume = Math.max(0, Math.min(1, parseFloat(val)));
  }
}

function setAmbientVolume(val) {
  if (ambientPlayer) {
    ambientPlayer.volume = Math.max(0, Math.min(1, val / 100));
  }
}

function changeAmbientVolume(val) {
  if (ambientPlayer) {
    ambientPlayer.volume = Math.max(0, Math.min(1, parseFloat(val)));
  }
}

function seekAudioTrack(val) {
  if (audioPlayer && audioPlayer.duration) {
    audioPlayer.currentTime = (val / 100) * audioPlayer.duration;
  }
}

function chooseSound(soundKey) {
  trackIdx = -1;
  const pills = document.querySelectorAll('.custom-track-pill');
  for (let i = 0; i < pills.length; i++) {
    pills[i].classList.remove('active');
  }

  const btns = document.querySelectorAll('.sound-btn');
  for (let i = 0; i < btns.length; i++) {
    const b = btns[i];
    b.classList.toggle('active', b.getAttribute('data-sound') === soundKey);
  }

  const title = SOUND_NAMES[soundKey] || 'Cozy Audio';
  const nameEl = $('musicName');
  if (nameEl) nameEl.textContent = title;
  const miniSongEl = $('miniSong');
  if (miniSongEl) miniSongEl.textContent = title;

  const src = TRACKS[soundKey];
  if (src && audioPlayer) {
    audioPlayer.src = src;
    audioPlayer.load();
    playMusic();
  }
}

function toggleAmbientLayer(kind) {
  if (!ambientPlayer) return;
  const btns = document.querySelectorAll('.ambient-btn');

  if (ambientKind === kind) {
    ambientPlayer.pause();
    ambientKind = null;
    for (let i = 0; i < btns.length; i++) btns[i].classList.remove('active');
    return;
  }

  ambientKind = kind;
  for (let i = 0; i < btns.length; i++) {
    const b = btns[i];
    b.classList.toggle('active', b.getAttribute('data-ambient') === kind);
  }

  const src = TRACKS[kind];
  if (src) {
    ambientPlayer.src = src;
    ambientPlayer.load();
    ambientPlayer.play().catch(() => {});
  }
}

async function handleTrackUpload(evt) {
  const files = evt.target?.files || (evt.dataTransfer && evt.dataTransfer.files);
  if (!files || !files.length) return;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (!f.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|aac)$/i.test(f.name)) {
      continue;
    }
    const url = URL.createObjectURL(f);
    const trackId = await saveTrackToDb(f.name, f);
    uploadedTracks.push({ id: trackId, name: f.name.replace(/\.[^/.]+$/, ''), url });
  }

  renderUploadedTracks();
  showCelebration('track loaded: ' + files[0].name);
}

function renderUploadedTracks() {
  const container = $('uploadedTracksList');
  if (!container) return;
  container.innerHTML = '';

  for (let i = 0; i < uploadedTracks.length; i++) {
    const t = uploadedTracks[i];
    const pill = document.createElement('div');
    pill.className = 'custom-track-pill' + (trackIdx === i ? ' active' : '');
    pill.setAttribute('data-index', i);
    pill.innerHTML = '<span>🎵 ' + escapeHtml(t.name) + '</span><button type="button" class="remove-track-btn" title="Remove">×</button>';
    container.appendChild(pill);
  }
}

function playUploadedTrack(idx) {
  if (idx < 0 || idx >= uploadedTracks.length || !audioPlayer) return;
  trackIdx = idx;
  audioPlayer.src = uploadedTracks[idx].url;
  audioPlayer.load();

  const btns = document.querySelectorAll('.sound-btn');
  for (let i = 0; i < btns.length; i++) btns[i].classList.remove('active');

  renderUploadedTracks();
  playMusic();
}

function removeUploadedTrack(idx) {
  const track = uploadedTracks[idx];
  if (track && track.url) URL.revokeObjectURL(track.url);
  if (track && track.id) deleteTrackFromDb(track.id);

  uploadedTracks.splice(idx, 1);
  if (trackIdx === idx) {
    trackIdx = -1;
    chooseSound('lofi');
  } else if (trackIdx > idx) {
    trackIdx--;
  }
  renderUploadedTracks();
}

function setupMusicDropZone() {
  const dropZone = $('musicDropZone');
  if (!dropZone) return;

  const dragEvents = ['dragenter', 'dragover'];
  for (let i = 0; i < dragEvents.length; i++) {
    dropZone.addEventListener(dragEvents[i], e => {
      e.preventDefault();
      dropZone.classList.add('drag-active');
    });
  }

  const leaveEvents = ['dragleave', 'drop'];
  for (let i = 0; i < leaveEvents.length; i++) {
    dropZone.addEventListener(leaveEvents[i], e => {
      e.preventDefault();
      dropZone.classList.remove('drag-active');
    });
  }

  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    handleTrackUpload(e);
  });
}

function exportUserData() {
  const payload = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    goals: store.get('cozyGoals', []),
    tasks: store.get('cozyPlannerTasks', []),
    books: store.get('cozyShelfBooks', []),
    notes: store.get('cozyNotesData', []),
    xp: +store.get('cozyXP', 0),
    level: +store.get('cozyLevel', 1),
    streak: +store.get('cozyCycleStreak', 0),
    minutes: +store.get('cozyTodayMinutes', 0),
    theme: store.get('cozyTheme', 'sakura-morning')
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = 'studyspace-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
  showCelebration('backup exported');
}

function importUserData(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  // do not load file if bigger than two megabytes
  if (file.size > 2 * 1024 * 1024) {
    showCelebration('file exceeds 2MB limit');
    return;
  }

  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const data = JSON.parse(evt.target.result);
      if (!data) return;

      if (Array.isArray(data.goals)) store.set('cozyGoals', data.goals);
      if (Array.isArray(data.tasks)) store.set('cozyPlannerTasks', data.tasks);
      if (Array.isArray(data.books)) store.set('cozyShelfBooks', data.books);
      if (Array.isArray(data.notes)) store.set('cozyNotesData', data.notes);

      if (Number.isFinite(data.xp)) {
        xp = data.xp;
        store.set('cozyXP', xp);
      }
      if (Number.isFinite(data.level)) {
        level = data.level;
        store.set('cozyLevel', level);
      }
      if (Number.isFinite(data.streak)) store.set('cozyCycleStreak', data.streak);
      if (Number.isFinite(data.minutes)) store.set('cozyTodayMinutes', data.minutes);
      if (data.theme) applyTheme(data.theme);

      bus.emit('data:imported');
      updateProgress();
      showCelebration('study room restored');
    } catch {
      showCelebration('invalid backup JSON');
    }
  };
  reader.readAsText(file);
}

const availableThemes = ['cozy-night', 'rainy-window', 'sakura-morning', 'dark-academia'];
const themePreviewMap = {
  'cozy-night': 'assets/images/Cozy-study-room.webp',
  'rainy-window': 'assets/images/rainy-window.gif',
  'sakura-morning': 'assets/images/sakura-morning.gif',
  'dark-academia': 'assets/images/dark-academia.gif'
};

function changeTheme(val) {
  const chosen = val || $('themeSelect')?.value;
  if (chosen) applyTheme(chosen);
}

function applyTheme(theme) {
  const selected = availableThemes.includes(theme) ? theme : 'sakura-morning';
  for (let i = 0; i < availableThemes.length; i++) {
    document.body.classList.remove(availableThemes[i]);
  }
  document.body.classList.add(selected);

  const preview = $('previewImg');
  if (preview && themePreviewMap[selected]) {
    preview.src = themePreviewMap[selected];
  }

  store.set('cozyTheme', selected);

  const selects = document.querySelectorAll('#themeSelect, .theme-select');
  for (let i = 0; i < selects.length; i++) {
    selects[i].value = selected;
  }
}

function loadTheme() {
  for (let i = 0; i < availableThemes.length; i++) {
    document.body.classList.remove(availableThemes[i]);
  }
  document.body.classList.add('sakura-morning');
  const preview = $('previewImg');
  if (preview) preview.src = themePreviewMap['sakura-morning'];
  const sel = $('themeSelect');
  if (sel) sel.value = store.get('cozyTheme', 'sakura-morning');
}

function toggleFocusMode() {
  const isFocus = document.body.classList.toggle('focus-mode');
  const btn = $('focusModeBtn');
  if (isFocus) {
    setCatMood('excited');
    if (btn) btn.textContent = 'leave deep focus ☼';
    showCelebration('deep focus active ☾');
  } else {
    document.body.classList.remove('focus-mode');
    setCatMood('blink');
    if (btn) btn.textContent = 'enter deep focus ☾';
  }
}

function handleBackdropClick(e, modalId) {
  if (e.target.id === modalId) e.target.classList.add('hidden');
}

// run code when user clicks any button on the page
document.addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (btn) {
    const action = btn.dataset.action;
    const goalCard = btn.closest('.goal-card');
    if (goalCard) {
      const id = goalCard.dataset.id;
      if (action === 'step-down') window.toggleGoalStep?.(id, -1);
      else if (action === 'step-up') window.toggleGoalStep?.(id, 1);
      else if (action === 'delete') window.deleteGoal?.(id);
      return;
    }

    const taskRow = btn.closest('.planner-task-item');
    if (taskRow) {
      const id = taskRow.dataset.id;
      if (action === 'toggle') window.toggleTaskCompleted?.(id);
      else if (action === 'focus') window.startFocusOnTask?.(id);
      else if (action === 'move-up') window.moveTask?.(id, -1);
      else if (action === 'move-down') window.moveTask?.(id, 1);
      else if (action === 'delete') window.deletePlannerTask?.(id);
      return;
    }

    if (btn.classList.contains('delete-note-btn')) {
      window.deleteNote?.(btn);
      return;
    }
  }

  const trackItem = e.target.closest('.custom-track-pill') || e.target.closest('.uploaded-track-item');
  if (trackItem) {
    const idx = +trackItem.getAttribute('data-index');
    if (e.target.closest('.remove-track-btn')) {
      removeUploadedTrack(idx);
    } else {
      playUploadedTrack(idx);
    }
    return;
  }

  // TODO: shelf books have click handlers here and inside shelf module
  const shelfBook = e.target.closest('.shelf-book');
  if (shelfBook) {
    const bookId = shelfBook.getAttribute('data-id');
    if (bookId) window.openBookDetail?.(bookId);
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    window.closeBookDetailModal?.();
    window.closeAddBookModal?.();
    window.closeAddGoalModal?.();
    window.closeCustomTimerModal?.();
    const openModals = document.querySelectorAll('.cozy-modal-backdrop:not(.hidden)');
    for (let i = 0; i < openModals.length; i++) {
      openModals[i].classList.add('hidden');
    }
    return;
  }
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable)) {
    return;
  }
  if (document.querySelector('.cozy-modal-backdrop:not(.hidden)')) return;

  if (e.code === 'Space') {
    e.preventDefault();
    if (window.timerInterval) window.pauseTimer?.();
    else window.startTimer?.();
  } else if (e.key === 'f' || e.key === 'F') {
    toggleFocusMode();
  }
});

bus.on('xp:add', n => addXP(n));
bus.on('toast', msg => showCelebration(msg));
bus.on('cat:bubble', msg => showCatBubble(msg));
bus.on('cat:mood', m => setCatMood(m));

// share functions on window so other scripts can use them
Object.assign(window, {
  store,
  readData: (k, fb) => store.get(k, fb),
  writeData: (k, v) => store.set(k, v),
  escapeHtml,
  sanitizeUrl,
  addXP,
  showCelebration,
  showCatNotification: showCatBubble,
  setCatMood,
  petCat,
  enterRoom,
  leaveRoom,
  togglePlay,
  setVolume,
  setAmbientVolume,
  chooseSound,
  toggleAmbientLayer,
  handleTrackUpload,
  exportUserData,
  importUserData,
  changeTheme,
  applyTheme,
  toggleFocusMode,
  handleBackdropClick,
  updateProgress,
  changeVolume,
  changeAmbientVolume,
  seekAudioTrack
});

window.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  loadTracksFromDb();
  setupMusicDropZone();
  updateProgress();
  chooseSound('lofi');

  if (audioPlayer) {
    audioPlayer.addEventListener('timeupdate', () => {
      const cur = audioPlayer.currentTime || 0;
      const dur = audioPlayer.duration || 0;
      const seekbar = $('audioTrackSeekbar');
      if (seekbar && dur > 0) {
        seekbar.value = Math.floor((cur / dur) * 100);
      }
      const label = $('audioTimeLabel');
      if (label) {
        const formatSec = s => {
          const m = Math.floor(s / 60);
          const rem = Math.floor(s % 60);
          return m + ':' + String(rem).padStart(2, '0');
        };
        label.textContent = formatSec(cur) + ' / ' + (dur > 0 ? formatSec(dur) : '0:00');
      }
    });
  }
});

window.addEventListener('storage', evt => {
  if (evt.key === 'cozyXP' || evt.key === 'cozyLevel') {
    xp = +store.get('cozyXP', 0);
    level = +store.get('cozyLevel', 1);
    updateProgress();
  }
});