// pomodoro clock and chime sounds
// handles focus time and short breaks

(() => {
  const PRESETS = {
    25: { id: 'focus', title: 'focus session (25m)' },
    5:  { id: 'short', title: 'short break (5m)' },
    15: { id: 'long',  title: 'long rest (15m)' }
  };

  const FREQS = { C4: 261.63, E4: 329.63, G4: 392.00, A4: 440.00, C5: 523.25, D5: 587.33, A5: 880.00 };

  const store = window.store || {
    get: (key, fallback = null) => {
      try {
        const item = localStorage.getItem(key);
        return item != null ? JSON.parse(item) : fallback;
      } catch (err) {
        return fallback;
      }
    },
    set: (key, val) => {
      try {
        localStorage.setItem(key, JSON.stringify(val));
      } catch (err) {
        // storage is full
      }
    }
  };

  const state = {
    mins: 25,
    sec: 25 * 60,
    total: 25 * 60,
    tick: null,
    deadline: 0,
    mode: 'focus',
    soundOn: true,
    chime: store.get('cozyChimeType', 'bell'),
    streak: (+store.get('cozyCycleStreak', 0)) % 5,
    todayMins: +store.get('cozyTodayMinutes', 0),
    taskId: null,
    audioCtx: null
  };

  function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  // update clock text and progress bar
  function updateDisplay() {
    const timeText = formatTime(state.sec);
    const clockEl = document.getElementById('timer') || document.getElementById('timerDisplay');
    if (clockEl) {
      clockEl.textContent = timeText;
    }

    const progressEl = document.getElementById('timerProgressBar');
    if (progressEl && state.total > 0) {
      const elapsed = state.total - state.sec;
      const pct = Math.min(100, Math.max(0, (elapsed / state.total) * 100));
      progressEl.style.width = pct.toFixed(1) + '%';
    }

    document.title = state.tick ? `(${timeText}) CozySpace` : 'CozySpace ☕ - Interactive Study Room';
  }

  // pick focus or break minutes
  function setMode(mins) {
    state.mins = mins;
    state.sec = state.total = mins * 60;

    const modeBtns = document.querySelectorAll('.mode-btn');
    for (let i = 0; i < modeBtns.length; i++) {
      const btn = modeBtns[i];
      const match = +btn.getAttribute('data-minutes') === mins;
      btn.classList.toggle('active', match);
    }

    const preset = PRESETS[mins] || { id: 'custom', title: `custom focus (${mins}m)` };
    state.mode = preset.id;

    const label = document.getElementById('timerLabel');
    if (label) {
      label.textContent = preset.title;
    }

    clearInterval(state.tick);
    state.tick = null;
    document.getElementById('startBtn')?.classList.remove('btn-active-running');
    updateDisplay();
  }

  // show desktop popup alert
  function sendBrowserNotification(title, body) {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      try {
        new Notification(title, { body, icon: 'assets/images/catblink.gif' });
      } catch (err) {
        // phone browser could not make popup
      }
    } else if (Notification.permission === 'default' && window.isSecureContext) {
      Notification.requestPermission().catch(() => {});
    }
  }

  // count down seconds until zero
  function startTimer() {
    if (state.tick) return;
    if (typeof Notification !== 'undefined' && Notification.permission === 'default' && window.isSecureContext) {
      Notification.requestPermission().catch(() => {});
    }

    state.deadline = Date.now() + state.sec * 1000;
    state.tick = setInterval(() => {
      const remaining = Math.max(0, Math.round((state.deadline - Date.now()) / 1000));
      state.sec = remaining;

      if (remaining > 0) {
        // give xp every full minute of focus
        if (remaining % 60 === 0 && (state.mode === 'focus' || state.mode === 'custom')) {
          window.cozyBus?.emit('xp:add', 2);
        }
        updateDisplay();
      } else {
        handleTimerEnd();
      }
    }, 1000);

    window.cozyBus?.emit('cat:mood', 'blink');
    document.getElementById('startBtn')?.classList.add('btn-active-running');
  }

  function pauseTimer() {
    clearInterval(state.tick);
    state.tick = null;
    state.deadline = 0;
    document.getElementById('startBtn')?.classList.remove('btn-active-running');
  }

  function resetTimer() {
    pauseTimer();
    state.sec = state.mins * 60;
    updateDisplay();
  }

  // jump straight to next session
  function skipTimer() {
    pauseTimer();
    const isWorkSession = state.mode === 'focus' || state.mode === 'custom';
    setMode(isWorkSession ? 5 : 25);
    window.cozyBus?.emit('cat:bubble', 'skipped forward ⏭');
  }

  function toggleTimerSound() {
    state.soundOn = !state.soundOn;
    const toggleBtn = document.getElementById('soundToggleBtn');
    if (toggleBtn) {
      toggleBtn.textContent = state.soundOn ? '🔔 chime on' : '🔕 chime off';
    }
  }

  function setChimeType(val) {
    state.chime = val;
    store.set('cozyChimeType', val);
    playTone();
  }

  // play pleasant synth chime on web audio
  // TODO add soft harp sound preset
  function playTone() {
    if (!state.soundOn || typeof window === 'undefined') return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      if (!state.audioCtx) {
        state.audioCtx = new AudioCtx();
      }
      if (state.audioCtx.state === 'suspended') {
        state.audioCtx.resume();
      }

      const ctx = state.audioCtx;
      const t0 = ctx.currentTime;
      const gainNode = ctx.createGain();
      gainNode.connect(ctx.destination);

      const chimePresets = {
        bowl: { freqs: [FREQS.C4, FREQS.C5], decay: 1.2, vol: 0.2 },
        blip: { freqs: [FREQS.A4], ramp: FREQS.A5, type: 'square', decay: 0.2, vol: 0.1 },
        bell: { freqs: [FREQS.D5], ramp: FREQS.A5, decay: 0.45, vol: 0.15 }
      };

      const cfg = chimePresets[state.chime] || chimePresets.bell;
      const activeOscs = [];

      for (let i = 0; i < cfg.freqs.length; i++) {
        const pitch = cfg.freqs[i];
        const osc = ctx.createOscillator();
        osc.type = cfg.type || 'sine';
        osc.frequency.setValueAtTime(pitch, t0);
        if (cfg.ramp) {
          osc.frequency.setValueAtTime(cfg.ramp, t0 + 0.1);
        }
        osc.connect(gainNode);
        activeOscs.push(osc);
      }

      gainNode.gain.setValueAtTime(cfg.vol, t0);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + cfg.decay);

      for (let j = 0; j < activeOscs.length; j++) {
        const osc = activeOscs[j];
        osc.start(t0);
        osc.stop(t0 + cfg.decay + 0.05);
      }

      setTimeout(() => {
        try {
          for (let k = 0; k < activeOscs.length; k++) {
            activeOscs[k].disconnect();
          }
          gainNode.disconnect();
        } catch {
          // audio node shut down
        }
      }, (cfg.decay + 0.2) * 1000);
    } catch (err) {
      // browser audio blocked before first touch
    }
  }

  // runs when timer hits zero
  function handleTimerEnd() {
    pauseTimer();
    playTone();

    const isWorkSession = state.mode === 'focus' || state.mode === 'custom';
    if (isWorkSession) {
      state.streak = (state.streak % 4) + 1;
      state.todayMins += state.mins;

      store.set('cozyCycleStreak', state.streak);
      store.set('cozyTodayMinutes', state.todayMins);

      window.cozyBus?.emit('xp:add', 25);
      window.cozyBus?.emit('session:done', { mins: state.mins, taskId: state.taskId });
      window.cozyBus?.emit('toast', `session done! +25 xp (${state.mins}m)`);
      window.cozyBus?.emit('cat:mood', 'excited');

      const takeLongBreak = state.streak === 4;
      const msg = takeLongBreak ? '4 pomodoros done! Take a 15m rest ☕' : 'Focus complete! Take a 5m break 🍵';
      window.cozyBus?.emit('cat:bubble', msg);
      sendBrowserNotification('Pomodoro Done 🍅', msg);

      setMode(takeLongBreak ? 15 : 5);
    } else {
      window.cozyBus?.emit('toast', 'break ended');
      window.cozyBus?.emit('cat:bubble', 'break over! back to work? ✨');
      sendBrowserNotification('Break Over ✨', 'Time for the next study session.');
      window.cozyBus?.emit('cat:mood', 'blink');
      setMode(25);
    }

    renderIndicators();
    window.updateProgress?.();
  }

  // draw tomato dots and day minutes
  function renderIndicators() {
    const box = document.getElementById('cycleDots');
    if (box) {
      let html = '';
      let n = 1;
      while (n <= 4) {
        const active = n <= state.streak;
        html += `<span class="cycle-dot ${active ? 'filled' : ''}">${active ? '🍅' : '⚪'}</span>`;
        n++;
      }
      box.innerHTML = html;
    }

    const streakEl = document.getElementById('streakCount');
    if (streakEl) {
      streakEl.textContent = state.streak + '/4';
    }
    const minsEl = document.getElementById('minutesToday');
    if (minsEl) {
      minsEl.textContent = state.todayMins + 'm';
    }
  }

  // make short text of todays study time
  function getDailySummary() {
    const streak = state.streak;
    const mins = state.todayMins;
    const chime = state.chime;

    const cycles = Math.floor(streak / 4);
    const remaining = streak % 4;

    let summaryText = '';
    if (mins === 0) {
      summaryText = 'no sessions yet today';
    } else if (mins < 25) {
      summaryText = `${mins}m focused so far`;
    } else {
      summaryText = `${mins}m focused`;
      if (cycles > 0) {
        summaryText += `, ${cycles} full cycle${cycles > 1 ? 's' : ''} done`;
      }
      if (remaining > 0) {
        summaryText += `, ${remaining}/4 toward next cycle`;
      }
    }

    const label = document.getElementById('minutesToday');
    if (label) {
      label.title = summaryText;
    }

    return summaryText;
  }

  // show task being timed
  function setActiveTimerTask(id, title) {
    state.taskId = id;
    const label = document.getElementById('activeTaskLabel');
    if (label) {
      label.textContent = title;
    }
    document.getElementById('activeTaskTag')?.classList.remove('hidden');
  }

  function clearActiveTimerTask() {
    state.taskId = null;
    document.getElementById('activeTaskTag')?.classList.add('hidden');
  }

  function openCustomTimerModal() {
    document.getElementById('customTimerModal')?.classList.remove('hidden');
    document.getElementById('customMinutesInput')?.focus();
  }

  function closeCustomTimerModal() {
    document.getElementById('customTimerModal')?.classList.add('hidden');
  }

  function setCustomMinutesValue(v) {
    const inp = document.getElementById('customMinutesInput');
    if (inp) {
      inp.value = v;
    }
  }

  // apply custom number of minutes
  function applyCustomTimer() {
    const inp = document.getElementById('customMinutesInput');
    const val = parseInt(inp?.value || '30', 10);
    // keep timer between one minute and six hours
    if (!val || val <= 0 || val > 360) {
      return inp?.focus();
    }
    closeCustomTimerModal();
    setMode(val);
  }

  window.cozyBus?.on('data:imported', () => {
    state.streak = (+store.get('cozyCycleStreak', 0)) % 5;
    state.todayMins = +store.get('cozyTodayMinutes', 0);
    renderIndicators();
  });

  Object.assign(window, {
    startTimer,
    pauseTimer,
    resetTimer,
    skipTimer,
    setMode,
    toggleTimerSound,
    setChimeType,
    updateTimer: updateDisplay,
    updateCycleIndicators: renderIndicators,
    setActiveTimerTask,
    clearActiveTimerTask,
    openCustomTimerModal,
    closeCustomTimerModal,
    setCustomMinutesValue,
    applyCustomTimer,
    cozyTimer: { linkTask: setActiveTimerTask }
  });

  window.addEventListener('DOMContentLoaded', () => {
    updateDisplay();
    renderIndicators();
    const chimeSelect = document.getElementById('chimeSoundSelect');
    if (chimeSelect) chimeSelect.value = state.chime;
  });
})();
