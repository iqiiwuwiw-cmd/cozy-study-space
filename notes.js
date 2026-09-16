(() => {
  const DEFAULT_NOTE_BG = '#fff3a6';
  let activeColor = DEFAULT_NOTE_BG;
  let cache = null;

  // read sticky notes from storage
  function loadNotes() {
    if (cache) return cache;
    const raw = window.store ? window.store.get('cozyNotesData') : null;
    if (Array.isArray(raw)) {
      const notes = [];
      for (let i = 0; i < raw.length; i++) {
        const n = raw[i];
        if (typeof n === 'string') {
          notes.push({ text: n, color: DEFAULT_NOTE_BG });
        } else if (n && typeof n.text === 'string') {
          notes.push(n);
        }
      }
      cache = notes;
    } else {
      cache = [];
    }
    return cache;
  }

  // save notes to storage
  function saveNotes() {
    if (window.store && cache) {
      window.store.set('cozyNotesData', cache);
    }
  }

  // make note card html element
  function createNoteCard(note, idx) {
    const el = document.createElement('div');
    el.className = 'note';
    el.style.backgroundColor = note.color || DEFAULT_NOTE_BG;
    el.dataset.index = idx;

    const safe = window.escapeHtml ? window.escapeHtml(note.text) : note.text;
    el.innerHTML = `<span>${safe}</span><button type="button" class="delete-note-btn" title="Remove note">&times;</button>`;
    return el;
  }

  // draw notes on the wall
  // TODO add search box to find note by words
  function renderNotes() {
    const wall = document.getElementById('notesList');
    if (!wall) return;
    wall.innerHTML = '';
    const items = loadNotes();

    for (let i = 0; i < items.length; i++) {
      wall.appendChild(createNoteCard(items[i], i));
    }
  }

  // add note text to list and save
  function addNote() {
    const input = document.getElementById('noteInput');
    const txt = input ? input.value.trim() : '';
    if (!txt) return;

    const list = loadNotes();
    list.push({ text: txt, color: activeColor });
    saveNotes();
    renderNotes();

    input.value = '';
    if (window.cozyBus) {
      window.cozyBus.emit('xp:add', 10);
      window.cozyBus.emit('cat:bubble', 'note pinned! 📌');
    }
  }

  // remove note from board
  function deleteNote(btn) {
    const card = btn.closest('.note');
    if (!card) return;
    const noteIdx = +card.dataset.index;
    const list = loadNotes();
    if (!isNaN(noteIdx) && noteIdx >= 0 && noteIdx < list.length) {
      list.splice(noteIdx, 1);
      saveNotes();
      renderNotes();
    } else {
      card.remove();
    }
  }

  // pick color for new notes from preset buttons
  function selectNoteColor(hex, btn) {
    activeColor = hex;
    const swatches = document.querySelectorAll('.color-swatch');
    for (let i = 0; i < swatches.length; i++) {
      const s = swatches[i];
      s.classList.toggle('active', s === btn);
    }
    const box = document.getElementById('noteInput');
    if (box) {
      box.style.backgroundColor = hex;
    }
  }

  // set custom color from color wheel picker
  // TODO save chosen custom color to local storage
  function selectCustomColor(hex) {
    activeColor = hex;
    const swatches = document.querySelectorAll('.color-swatch');
    for (let i = 0; i < swatches.length; i++) {
      swatches[i].classList.remove('active');
    }
    const box = document.getElementById('noteInput');
    if (box) {
      box.style.backgroundColor = hex;
    }
  }

  // enter key adds note quickly
  const noteInputField = document.getElementById('noteInput');
  if (noteInputField) {
    noteInputField.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addNote();
      }
    });
  }

  if (window.cozyBus) {
    window.cozyBus.on('data:imported', () => {
      cache = null;
      renderNotes();
    });
  }

  Object.assign(window, {
    loadNotes: renderNotes,
    saveNotes,
    addNote,
    deleteNote,
    selectNoteColor,
    selectCustomColor
  });

  window.addEventListener('DOMContentLoaded', renderNotes);
})();
