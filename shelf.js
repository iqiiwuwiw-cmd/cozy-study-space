(() => {
  // starter books for new room
  const PRESET_BOOKS = [
    { id: 'b1', title: 'Physics formula sheet & midterm cram', subject: 'physics', type: 'reading', color: 'wood', url: 'https://tutorial.math.lamar.edu/', notes: 'Kinematics, free body diagrams & momentum cheat sheet.' },
    { id: 'b2', title: 'Stewart Calc II - integration drills', subject: 'math', type: 'pdf', color: 'sage', url: 'https://tutorial.math.lamar.edu/', notes: 'Integration by parts and series convergence problems.' },
    { id: 'b3', title: 'CS61B graph algorithms cheatsheet', subject: 'cs', type: 'reading', color: 'indigo', url: 'https://pages.cs.wisc.edu/', notes: 'DFS, BFS, Dijkstra and topological sort recap.' },
    { id: 'b4', title: '3Blue1Brown linear algebra series', subject: 'math', type: 'video', color: 'terracotta', url: 'https://www.youtube.com/', notes: 'Eigenvalues, eigenvectors and span geometric intuition.' },
    { id: 'b5', title: 'Cell membrane transport diagrams', subject: 'other', type: 'pdf', color: 'lavender', url: 'https://www.khanacademy.org/', notes: 'Osmosis, sodium-potassium pump steps for Friday quiz.' },
    { id: 'b6', title: 'Cal Newport - Deep Work notes', subject: 'reading', type: 'reading', color: 'sakura', url: 'https://calnewport.com/', notes: '90-min focus blocks, keeping phone out of sight.' },
    { id: 'b7', title: 'OSTEP virtual memory & paging', subject: 'cs', type: 'pdf', color: 'wood', url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/', notes: 'TLB miss handling, page replacement and clock algorithm.' }
  ];

  let collection = [];
  let currentFilter = 'all';
  let activeBookId = null;

  function escapeHtml(str) {
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(str);
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function sanitizeUrl(raw) {
    if (typeof window.sanitizeUrl === 'function') return window.sanitizeUrl(raw);
    const trimmed = String(raw || '').trim();
    if (!trimmed) return '';
    try {
      const parsed = new URL(trimmed, window.location.href);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.href;
      }
      return '';
    } catch {
      return '';
    }
  }

  // save books to browser storage
  function persist() {
    window.store?.set('cozyShelfBooks', collection);
  }

  // read saved books or use starter books
  function load() {
    const raw = window.store ? window.store.get('cozyShelfBooks') : null;
    if (raw == null) {
      collection = PRESET_BOOKS.map(b => ({ ...b }));
    } else if (Array.isArray(raw)) {
      collection = raw.map((b, idx) => {
        if (typeof b === 'string') {
          return {
            id: 'b_' + (idx + 1),
            title: b,
            subject: 'other',
            type: 'reading',
            color: 'wood',
            url: '',
            notes: ''
          };
        }
        return {
          id: b.id || ('b_' + Date.now() + '_' + idx),
          title: b.title || 'Untitled resource',
          subject: (b.subject || 'other').toLowerCase(),
          type: b.type || 'reading',
          color: b.color || 'wood',
          url: b.url || '',
          notes: b.notes || ''
        };
      });
    } else {
      collection = [];
    }
    renderShelf();
  }

  // show only books that match the topic
  function filterShelf(sub) {
    currentFilter = sub;
    const btns = document.querySelectorAll('#shelfFilterPills .filter-pill, #shelfFilterRow .shelf-filter-btn');
    for (let i = 0; i < btns.length; i++) {
      const b = btns[i];
      b.classList.toggle('active', b.getAttribute('data-subject') === sub);
    }
    renderShelf();
  }

  // draw books on the wood shelf
  // TODO let user drag books to change order
  function renderShelf() {
    const grid = document.getElementById('shelfPlanks');
    if (!grid) return;

    const visible = currentFilter === 'all'
      ? collection
      : collection.filter(b => b.subject === currentFilter);

    if (!visible.length) {
      grid.innerHTML = '<div class="empty-shelf-msg">no books on this shelf yet ~ add a reference 📚</div>';
      return;
    }

    const htmls = visible.map(book => {
      const sid = escapeHtml(book.id);
      const stitle = escapeHtml(book.title);
      const scolor = escapeHtml(book.color || 'wood');
      const ssubject = escapeHtml(book.subject || 'other');

      return (
        `<div class="shelf-book book-spine spine-${scolor}" data-id="${sid}" title="${stitle}">` +
          '<div class="spine-ribs"><span></span><span></span></div>' +
          `<span class="spine-title">${stitle}</span>` +
          `<span class="spine-subject">${ssubject}</span>` +
        '</div>'
      );
    });

    grid.innerHTML = htmls.join('');
  }

  function openAddBookModal() {
    const modal = document.getElementById('addBookModal');
    if (modal) modal.classList.remove('hidden');
    const input = document.getElementById('bookTitleInput');
    if (input) input.focus();
  }

  function closeAddBookModal() {
    const modal = document.getElementById('addBookModal');
    if (modal) modal.classList.add('hidden');
  }

  // take input and put new book on shelf
  function saveNewBook() {
    const input = document.getElementById('bookTitleInput');
    const title = input ? input.value.trim() : '';
    if (!title) {
      if (input) input.focus();
      return;
    }

    const subjectEl = document.getElementById('bookSubjectInput');
    const subject = (subjectEl && subjectEl.value.trim()) ? subjectEl.value.trim().toLowerCase() : 'other';

    const typeEl = document.getElementById('bookTypeSelect');
    const type = typeEl ? typeEl.value : 'reading';

    const colorEl = document.getElementById('bookColorSelect');
    const color = colorEl ? colorEl.value : 'wood';

    const urlInput = document.getElementById('bookUrlInput');
    const url = urlInput ? urlInput.value.trim() : '';

    const notesInput = document.getElementById('bookNotesInput');
    const notes = notesInput ? notesInput.value.trim() : '';

    const bookId = 'b_' + Date.now();
    collection.push({ id: bookId, title, subject, type, color, url, notes });

    persist();
    renderShelf();
    closeAddBookModal();

    if (input) input.value = '';
    if (subjectEl) subjectEl.value = '';
    if (urlInput) urlInput.value = '';
    if (notesInput) notesInput.value = '';

    if (window.cozyBus) {
      window.cozyBus.emit('xp:add', 10);
      window.cozyBus.emit('toast', 'book added to shelf');
    }
  }

  // show big card with book info
  // TODO let user edit notes from this card
  function openBookDetail(id) {
    const book = collection.find(b => b.id === id);
    if (!book) return;
    activeBookId = id;

    const modal = document.getElementById('bookDetailModal');
    if (!modal) return;

    const titleEl = document.getElementById('detailBookTitle');
    const subEl = document.getElementById('detailBookSubject');
    const typeEl = document.getElementById('detailBookType');
    const notesEl = document.getElementById('detailBookNotes');
    const linkEl = document.getElementById('detailBookOpenLink');

    if (titleEl) titleEl.textContent = book.title;
    if (subEl) subEl.textContent = book.subject;
    if (typeEl) typeEl.textContent = book.type;
    if (notesEl) notesEl.textContent = book.notes || 'no notes attached yet';

    if (linkEl) {
      const cleanUrl = sanitizeUrl(book.url);
      if (cleanUrl) {
        linkEl.href = cleanUrl;
        linkEl.classList.remove('hidden');
      } else {
        linkEl.classList.add('hidden');
      }
    }

    modal.classList.remove('hidden');
  }

  function closeBookDetailModal() {
    const modal = document.getElementById('bookDetailModal');
    if (modal) modal.classList.add('hidden');
    activeBookId = null;
  }

  // take book off shelf and save
  function deleteCurrentBook() {
    if (!activeBookId) return;

    collection = collection.filter(b => b.id !== activeBookId);
    persist();
    renderShelf();
    closeBookDetailModal();
    if (window.cozyBus) {
      window.cozyBus.emit('toast', 'book removed from shelf');
    }
  }

  // watch for user clicking on books
  // TODO: double click handler exists between here and the global listener in script.js
  function setupShelfClickListener() {
    const grid = document.getElementById('shelfPlanks');
    if (!grid) return;

    grid.addEventListener('click', e => {
      const bookCard = e.target.closest('.shelf-book');
      if (bookCard) {
        const id = bookCard.getAttribute('data-id');
        if (id) openBookDetail(id);
      }
    });
  }

  if (window.cozyBus) {
    window.cozyBus.on('data:imported', load);
  }

  Object.assign(window, {
    loadBookshelf: load,
    saveBookshelf: () => {
      if (window.store) window.store.set('cozyShelfBooks', collection);
    },
    filterShelf,
    openAddBookModal,
    closeAddBookModal,
    saveNewBook,
    openBookDetail,
    closeBookDetailModal,
    deleteCurrentBook
  });

  function init() {
    load();
    setupShelfClickListener();
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
