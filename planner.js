(() => {
  // starter tasks for new room
  const INITIAL_TASKS = [
    { id: 't1', title: 'Review lecture notes (Linear Algebra)', subject: 'Math', duration: 25, period: 'today', priority: true, completed: false },
    { id: 't2', title: 'Write outline for literature essay', subject: 'English', duration: 45, period: 'today', priority: false, completed: false },
    { id: 't3', title: 'Complete Bio lab report diagrams', subject: 'Biology', duration: 30, period: 'week', priority: true, completed: true }
  ];

  let tasks = [];
  let selectedPeriod = 'today';

  // save tasks to storage
  function save() {
    window.store?.set('cozyPlannerTasks', tasks);
    render();
  }

  // read saved tasks or use starter tasks
  function load() {
    const raw = window.store ? window.store.get('cozyPlannerTasks') : null;
    if (Array.isArray(raw) && raw.length) {
      tasks = raw.map((t, idx) => {
        if (typeof t === 'string') {
          return {
            id: 't_' + (idx + 1),
            title: t,
            subject: 'General',
            duration: 25,
            period: 'today',
            priority: false,
            completed: false
          };
        }
        return {
          id: t.id || ('t_' + Date.now() + '_' + idx),
          title: t.title || 'Untitled task',
          subject: t.subject || 'General',
          duration: +t.duration || 25,
          period: t.period || 'today',
          priority: Boolean(t.priority),
          completed: Boolean(t.completed)
        };
      });
    } else {
      tasks = INITIAL_TASKS.map(t => ({ ...t }));
    }
    render();
  }

  // show tasks for today or this week
  function setPlannerPeriod(period) {
    selectedPeriod = period;
    const tabs = document.querySelectorAll('#plannerPeriodPills .filter-pill, #plannerPeriodTabs .tab-btn');
    for (let i = 0; i < tabs.length; i++) {
      const btn = tabs[i];
      btn.classList.toggle('active', btn.getAttribute('data-period') === period);
    }
    render();
  }

  // draw tasks on the lined paper
  // TODO let user filter tasks by subject tag
  function render() {
    const list = document.getElementById('plannerList');
    if (!list) return;

    const visible = selectedPeriod === 'all'
      ? tasks
      : tasks.filter(t => t.period === selectedPeriod);

    if (!visible.length) {
      list.innerHTML = '<div class="empty-planner-msg">no tasks for this view ~ clear desk! 🍵</div>';
      return;
    }

    const rows = visible.map(t => {
      const tid = window.escapeHtml ? window.escapeHtml(t.id) : t.id;
      const ttitle = window.escapeHtml ? window.escapeHtml(t.title) : t.title;
      const tsub = window.escapeHtml ? window.escapeHtml(t.subject) : t.subject;

      return (
        `<div class="planner-task-item ${t.completed ? 'completed' : ''} ${t.priority ? 'priority' : ''}" data-id="${tid}">` +
          '<div class="task-check-wrap">' +
            `<button type="button" class="task-checkbox" data-action="toggle" title="Toggle complete">${t.completed ? '✓' : ''}</button>` +
          '</div>' +
          '<div class="task-main-col">' +
            `<span class="task-title-text">${ttitle}</span>` +
            '<div class="task-meta-row">' +
              `<span class="task-subject-tag">${tsub}</span>` +
              `<span class="task-duration-tag">⏱ ${t.duration || 25}m</span>` +
              (t.priority ? '<span class="task-priority-badge">⭐ priority</span>' : '') +
            '</div>' +
          '</div>' +
          '<div class="task-actions-col">' +
            '<button type="button" class="task-action-btn focus-btn" data-action="focus" title="Focus on this task">🎯</button>' +
            '<button type="button" class="task-action-btn reorder-btn" data-action="move-up" title="Move up">▲</button>' +
            '<button type="button" class="task-action-btn reorder-btn" data-action="move-down" title="Move down">▼</button>' +
            '<button type="button" class="task-action-btn del-btn" data-action="delete" title="Delete task">&times;</button>' +
          '</div>' +
        '</div>'
      );
    });

    list.innerHTML = rows.join('');
  }

  // add task from top bar to list
  function saveNewTask() {
    const titleInput = document.getElementById('taskTitleInput');
    const txt = titleInput ? titleInput.value.trim() : '';
    if (!txt) {
      if (titleInput) titleInput.focus();
      return;
    }

    const subInput = document.getElementById('taskSubjectInput');
    const subject = (subInput && subInput.value.trim()) ? subInput.value.trim() : 'General';

    const durSelect = document.getElementById('taskDurationSelect');
    const duration = durSelect ? parseInt(durSelect.value, 10) || 25 : 25;

    const priCheck = document.getElementById('taskPriorityInput');
    const priority = Boolean(priCheck && priCheck.checked);

    tasks.push({
      id: 't_' + Date.now(),
      title: txt,
      subject,
      duration,
      period: selectedPeriod === 'all' ? 'today' : selectedPeriod,
      priority,
      completed: false
    });
    save();

    if (titleInput) titleInput.value = '';
    if (subInput) subInput.value = '';
    if (priCheck) priCheck.checked = false;

    if (window.cozyBus) {
      window.cozyBus.emit('xp:add', 10);
      window.cozyBus.emit('toast', 'task added to planner');
    }
  }

  // check or uncheck task
  function toggleTask(id) {
    const target = tasks.find(t => t.id === id);
    if (!target) return;

    target.completed = !target.completed;
    if (target.completed && window.cozyBus) {
      window.cozyBus.emit('xp:add', 15);
      window.cozyBus.emit('toast', 'task finished! +15 xp');
      window.cozyBus.emit('cat:mood', 'excited');
    }
    save();
  }

  // remove task from list
  function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    save();
  }

  // move task one slot higher or lower
  function moveTask(id, dir) {
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return;

    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= tasks.length) return;

    const [item] = tasks.splice(idx, 1);
    tasks.splice(targetIdx, 0, item);
    save();
  }

  // link task title to pomodoro timer
  function focusOnTask(id) {
    const t = tasks.find(item => item.id === id);
    if (!t) return;

    if (window.setActiveTimerTask) {
      window.setActiveTimerTask(t.id, t.title);
    }
    if (window.cozyBus) {
      window.cozyBus.emit('toast', `timer linked to: ${t.title}`);
    }
  }

  // listen for clicks and enter key
  function setupPlannerClickListener() {
    const listEl = document.getElementById('plannerList');
    if (!listEl) return;

    listEl.addEventListener('click', e => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;

      const item = btn.closest('.planner-task-item');
      if (!item) return;

      const id = item.getAttribute('data-id');
      const action = btn.getAttribute('data-action');

      if (action === 'toggle') toggleTask(id);
      else if (action === 'delete') deleteTask(id);
      else if (action === 'move-up') moveTask(id, -1);
      else if (action === 'move-down') moveTask(id, 1);
      else if (action === 'focus') focusOnTask(id);
    });

    const titleInput = document.getElementById('taskTitleInput');
    if (titleInput) {
      titleInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveNewTask();
        }
      });
    }
  }

  if (window.cozyBus) {
    window.cozyBus.on('data:imported', load);
  }

  Object.assign(window, {
    loadPlannerTasks: load,
    savePlannerTasks: () => {
      if (window.store) window.store.set('cozyPlannerTasks', tasks);
    },
    setPlannerPeriod,
    addPlannerTask: saveNewTask,
    saveNewTask,
    toggleTask,
    deleteTask,
    moveTask,
    focusOnTask
  });

  window.addEventListener('DOMContentLoaded', () => {
    load();
    setupPlannerClickListener();
  });
})();
