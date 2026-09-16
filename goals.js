(() => {
  // starter goals for new room
  const SEED_GOALS = [
    {
      id: 'g1',
      title: 'Read European History Chapter 6',
      timeframe: 'daily',
      target: 30,
      current: 18,
      unit: 'pages',
      autoTrack: false,
      completed: false
    },
    {
      id: 'g2',
      title: 'Complete Calculus exercise sets',
      timeframe: 'weekly',
      target: 4,
      current: 4,
      unit: 'sections',
      autoTrack: false,
      completed: true
    },
    {
      id: 'g3',
      title: 'Daily focus sessions',
      timeframe: 'daily',
      target: 4,
      current: 2,
      unit: 'pomodoros',
      autoTrack: true,
      completed: false
    }
  ];

  let goals = [];
  let currentFilter = 'all';

  // save goals to browser storage
  function persist() {
    window.store?.set('cozyGoals', goals);
    renderList();
  }

  // read saved goals or use starter goals
  function load() {
    const raw = window.store ? window.store.get('cozyGoals') : null;

    if (Array.isArray(raw) && raw.length) {
      goals = raw.map((item, idx) => {
        if (typeof item === 'string') {
          return {
            id: 'g_' + (idx + 1),
            title: item,
            timeframe: 'daily',
            target: 1,
            current: 0,
            unit: 'steps',
            autoTrack: false,
            completed: false
          };
        }
        const rawTarget = +item.target;
        const target = Math.max(1, rawTarget || 1);
        const current = Math.max(0, +item.current || 0);

        return {
          id: item.id || ('g_' + Date.now() + '_' + idx),
          title: item.title || 'Untitled Goal',
          timeframe: item.timeframe || 'daily',
          target,
          current,
          unit: item.unit || 'steps',
          autoTrack: Boolean(item.autoTrack || item.autoTrackPomodoros),
          completed: Boolean(item.completed)
        };
      });
    } else {
      goals = SEED_GOALS.map(g => ({ ...g }));
    }

    renderList();
  }

  // show goals by daily or weekly
  function filterGoals(filterName) {
    currentFilter = filterName;
    const pills = document.querySelectorAll('#goalFilterPills .filter-pill');
    for (let i = 0; i < pills.length; i++) {
      const el = pills[i];
      el.classList.toggle('active', el.dataset.filter === filterName);
    }
    renderList();
  }

  // draw goal cards on cork board
  // TODO let user drag goals to sort them
  function renderList() {
    const container = document.getElementById('goalsList');
    if (!container) return;

    const visible = currentFilter === 'all'
      ? goals
      : goals.filter(g => g.timeframe === currentFilter);

    if (!visible.length) {
      const emptyLabel = currentFilter === 'all' ? '' : currentFilter + ' ';
      container.innerHTML = `<p class="empty-goals-msg">no ${emptyLabel}goals pinned ~ add one above 🎯</p>`;
      return;
    }

    const cards = visible.map(g => {
      const safeTitle = window.escapeHtml ? window.escapeHtml(g.title) : g.title;
      const safeTimeframe = window.escapeHtml ? window.escapeHtml(g.timeframe) : g.timeframe;

      const pct = Math.min(100, Math.round((g.current / g.target) * 100));
      const autoBadge = g.autoTrack ? '<span class="goal-auto-badge" title="Auto bumps on timer finish">⚡ auto</span>' : '';
      const doneClass = g.completed ? 'is-done' : '';
      const doneLabel = g.completed ? '✓ done' : 'mark done';

      return (
        `<div class="goal-card ${g.completed ? 'completed' : ''}" data-id="${g.id}">` +
          '<div class="goal-header">' +
            '<div style="display:flex;align-items:center;gap:6px;">' +
              `<span class="goal-badge ${safeTimeframe}">${safeTimeframe}</span>` +
              autoBadge +
            '</div>' +
            '<button type="button" class="goal-delete-btn" data-action="delete" title="Delete goal">&times;</button>' +
          '</div>' +
          `<div class="goal-title">${safeTitle}</div>` +
          '<div class="goal-progress-wrap">' +
            `<div class="goal-track"><div class="goal-meter" style="width: ${pct}%;"></div></div>` +
            '<div class="goal-progress-text">' +
              `<span>${g.current}/${g.target} ${g.unit}</span>` +
              (g.completed ? '<span class="goal-completed-badge">✓ done</span>' : '') +
            '</div>' +
          '</div>' +
          '<div class="goal-actions-row">' +
            '<div class="goal-stepper-group">' +
              '<button type="button" class="goal-stepper-btn" data-action="decrement" title="Step down">-1</button>' +
              '<button type="button" class="goal-stepper-btn" data-action="increment" title="Step up">+1</button>' +
            '</div>' +
            `<button type="button" class="cozy-modal-btn ${g.completed ? 'cancel' : 'confirm'}" data-action="toggle-complete" style="padding:4px 14px !important;font-size:18px !important;border-radius:10px !important;">${doneLabel}</button>` +
          '</div>' +
        '</div>'
      );
    });

    container.innerHTML = cards.join('');
  }

  function openAddGoalModal() {
    const modal = document.getElementById('addGoalModal');
    if (modal) modal.classList.remove('hidden');
    const input = document.getElementById('goalTitleInput');
    if (input) input.focus();
  }

  function closeAddGoalModal() {
    const modal = document.getElementById('addGoalModal');
    if (modal) modal.classList.add('hidden');
  }

  // make new goal from modal form
  function saveNewGoal() {
    const input = document.getElementById('goalTitleInput');
    const title = input ? input.value.trim() : '';

    if (!title) {
      if (input) input.focus();
      return;
    }

    const selectEl = document.getElementById('goalTypeSelect');
    const timeframe = selectEl ? selectEl.value : 'daily';

    const targetInput = document.getElementById('goalTargetInput');
    const rawTarget = targetInput ? targetInput.value : '1';
    const target = Math.max(1, parseInt(rawTarget, 10) || 1);

    const metricInput = document.getElementById('goalMetricInput');
    const unit = (metricInput && metricInput.value.trim()) ? metricInput.value.trim() : 'steps';

    const checkEl = document.getElementById('goalAutoSessionCheck');
    const autoTrack = Boolean(checkEl && checkEl.checked);

    goals.push({
      id: 'g_' + Date.now(),
      title,
      timeframe,
      target,
      current: 0,
      unit,
      autoTrack,
      completed: false
    });

    persist();
    closeAddGoalModal();

    if (input) input.value = '';
    if (window.cozyBus) {
      window.cozyBus.emit('toast', 'goal pinned to corkboard');
    }
  }

  // bump progress number up or down
  function toggleGoalStep(gid, stepVal) {
    const item = goals.find(g => g.id === gid);
    if (!item) return;

    const previouslyDone = item.completed;
    const nextVal = item.current + stepVal;
    item.current = Math.max(0, Math.min(item.target, nextVal));
    item.completed = item.current >= item.target;

    if (!previouslyDone && item.completed) {
      if (window.cozyBus) {
        window.cozyBus.emit('xp:add', 20);
        window.cozyBus.emit('toast', `goal accomplished: ${item.title}! +20 xp`);
        window.cozyBus.emit('cat:mood', 'excited');
      }
    }

    persist();
  }

  // toggle goal done status
  function toggleGoalComplete(gid) {
    const item = goals.find(g => g.id === gid);
    if (!item) return;

    item.completed = !item.completed;
    if (item.completed) {
      item.current = item.target;
      if (window.cozyBus) {
        window.cozyBus.emit('xp:add', 20);
        window.cozyBus.emit('toast', `goal accomplished: ${item.title}! +20 xp`);
        window.cozyBus.emit('cat:mood', 'excited');
      }
    } else {
      item.current = Math.max(0, item.target - 1);
    }

    persist();
  }

  // remove goal from board
  function deleteGoal(targetId) {
    goals = goals.filter(g => g.id !== targetId);
    persist();
  }

  // listen for clicks on goal buttons
  function setupGoalsClickListener() {
    const board = document.getElementById('goalsList');
    if (!board) return;

    board.addEventListener('click', e => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;

      const card = btn.closest('.goal-card');
      if (!card) return;

      const id = card.getAttribute('data-id');
      const action = btn.getAttribute('data-action');

      if (action === 'increment' || action === 'step-up') toggleGoalStep(id, 1);
      else if (action === 'decrement' || action === 'step-down') toggleGoalStep(id, -1);
      else if (action === 'toggle-complete') toggleGoalComplete(id);
      else if (action === 'delete') deleteGoal(id);
    });
  }

  // add progress when pomodoro timer finishes
  if (window.cozyBus) {
    window.cozyBus.on('session:done', () => {
      let touched = false;
      for (let i = 0; i < goals.length; i++) {
        const g = goals[i];
        if (g.autoTrack && !g.completed) {
          g.current = Math.min(g.target, g.current + 1);
          if (g.current >= g.target) {
            g.completed = true;
            if (window.cozyBus) {
              window.cozyBus.emit('xp:add', 25);
              window.cozyBus.emit('toast', 'goal achieved: ' + g.title);
            }
          }
          touched = true;
        }
      }
      if (touched) persist();
    });

    window.cozyBus.on('data:imported', load);
  }

  Object.assign(window, {
    loadGoals: load,
    saveGoals: () => {
      if (window.store) window.store.set('cozyGoals', goals);
    },
    filterGoals,
    openAddGoalModal,
    closeAddGoalModal,
    saveNewGoal,
    toggleGoalStep,
    toggleGoalComplete,
    deleteGoal,
    updateGoalsOnSessionComplete: () => {}
  });

  window.addEventListener('DOMContentLoaded', () => {
    load();
    setupGoalsClickListener();
  });
})();
