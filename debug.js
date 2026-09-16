// quick helpers for chrome devtools so i don't have to keep clicking around
// todo: add helper to simulate 4-pomodoro streak celebration

(function() {
  window.cozyDebug = {
    // add xp quick
    xp: function(n = 25) {
      if (window.cozyBus) {
        window.cozyBus.emit('xp:add', n);
      }
    },

    level: function(lvl = 5) {
      if (window.store) {
        window.store.set('cozyLevel', lvl);
        window.store.set('cozyXP', 0);
      }
      if (window.updateProgress) window.updateProgress();
    },

    streak: function(count = 3) {
      if (window.store) {
        window.store.set('cozyCycleStreak', count);
      }
      if (window.updateCycleIndicators) window.updateCycleIndicators();
    },

    // wipe cozy data to test empty states
    reset: function() {
      var allKeys = Object.keys(localStorage);
      for (var i = 0; i < allKeys.length; i++) {
        var k = allKeys[i];
        if (k.indexOf('cozy') === 0) {
          localStorage.removeItem(k);
        }
      }
      location.reload();
    },

    seed: function() {
      var fakeTasks = [
        { id: 'dbg_math', title: 'Calculus III vector fields review', subject: 'Math', duration: 45, period: 'today', priority: true, completed: false },
        { id: 'dbg_chem', title: 'Chem pre-lab titration quiz', subject: 'Chem', duration: 15, period: 'today', priority: false, completed: true },
        { id: 'dbg_cs', title: 'CS memory layout report', subject: 'CS', duration: 60, period: 'week', priority: true, completed: false }
      ];

      var current = [];
      if (window.store) {
        current = window.store.get('cozyPlannerTasks', []) || [];
        window.store.set('cozyPlannerTasks', current.concat(fakeTasks));
      }
      if (window.loadPlannerTasks) window.loadPlannerTasks();
    },

    clearTasks: function() {
      if (window.store) window.store.set('cozyPlannerTasks', []);
      if (window.loadPlannerTasks) window.loadPlannerTasks();
    },

    dump: function() {
      var res = {};
      var lsKeys = Object.keys(localStorage);
      for (var j = 0; j < lsKeys.length; j++) {
        var key = lsKeys[j];
        if (key.indexOf('cozy') === 0) {
          res[key] = window.store ? window.store.get(key) : localStorage.getItem(key);
        }
      }
      console.table(res);
    }
  };
})();
