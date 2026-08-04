/* =========================================================
   TaskPilot AI — Mock Data Store
   Stand-in for the Flask REST API during frontend-only work.
   Everything reads/writes through TP.store so swapping in
   real fetch() calls later only touches this one file.
   ========================================================= */

const TP = (function () {
  const LS_KEY = "taskpilot_v1";

  const DEFAULT_CATEGORIES = [
    { id: "study", name: "Study", color: "#8b6bff", icon: "fa-book" },
    { id: "work", name: "Work", color: "#22d3ee", icon: "fa-briefcase" },
    { id: "personal", name: "Personal", color: "#f6a723", icon: "fa-user" },
    { id: "shopping", name: "Shopping", color: "#fb5573", icon: "fa-bag-shopping" },
    { id: "health", name: "Health", color: "#2fd18f", icon: "fa-heart-pulse" },
  ];

  function todayISO(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  }

  function seedTasks() {
    return [
      { id: cryptoId(), title: "Submit Database Assignment", description: "Normalize schema to 3NF and push to GitHub.", category: "study", priority: "high", due_date: todayISO(0), due_time: "18:00", reminder_time: "17:00", status: "pending", pinned: true, created_at: Date.now() - 90000 },
      { id: cryptoId(), title: "Team standup notes", description: "Summarize sprint blockers for the AI module.", category: "work", priority: "medium", due_date: todayISO(0), due_time: "10:00", reminder_time: "", status: "completed", pinned: false, created_at: Date.now() - 800000 },
      { id: cryptoId(), title: "Buy groceries", description: "Milk, eggs, coffee, fruit.", category: "shopping", priority: "low", due_date: todayISO(1), due_time: "", reminder_time: "", status: "pending", pinned: false, created_at: Date.now() - 500000 },
      { id: cryptoId(), title: "Gym — leg day", description: "", category: "health", priority: "medium", due_date: todayISO(0), due_time: "19:00", reminder_time: "18:30", status: "pending", pinned: false, created_at: Date.now() - 300000 },
      { id: cryptoId(), title: "Prepare AI Advisor demo", description: "Record a 2-minute walkthrough of the recommendation flow.", category: "study", priority: "high", due_date: todayISO(2), due_time: "12:00", reminder_time: "", status: "pending", pinned: false, created_at: Date.now() - 200000 },
      { id: cryptoId(), title: "Pay electricity bill", description: "", category: "personal", priority: "medium", due_date: todayISO(-1), due_time: "", reminder_time: "", status: "pending", pinned: false, created_at: Date.now() - 700000 },
      { id: cryptoId(), title: "Plan weekend trip", description: "Shortlist 2 hill-station options.", category: "personal", priority: "low", due_date: todayISO(4), due_time: "", reminder_time: "", status: "pending", pinned: false, created_at: Date.now() - 100000 },
    ];
  }

  function cryptoId() {
    return "t_" + Math.random().toString(36).slice(2, 10);
  }

  function load() {
    let raw = localStorage.getItem(LS_KEY);
    if (!raw) {
      const seed = {
        user: null,
        theme: "dark",
        categories: DEFAULT_CATEGORIES,
        tasks: seedTasks(),
      };
      localStorage.setItem(LS_KEY, JSON.stringify(seed));
      return seed;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      localStorage.removeItem(LS_KEY);
      return load();
    }
  }

  function save(data) {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  }

  let db = load();

  const store = {
    // ---- theme ----
    getTheme() { return db.theme || "dark"; },
    setTheme(t) { db.theme = t; save(db); },

    // ---- user ----
    getUser() { return db.user; },
    setUserFromServer(user) { db.user = user; save(db); },
    clearUser() { db.user = null; save(db); },

    // ---- categories ----
    getCategories() { return db.categories; },
    addCategory(cat) { db.categories.push(cat); save(db); },
    updateCategory(id, patch) {
      db.categories = db.categories.map(c => c.id === id ? { ...c, ...patch } : c);
      save(db);
    },
    deleteCategory(id) {
      db.categories = db.categories.filter(c => c.id !== id);
      save(db);
    },
    getCategory(id) { return db.categories.find(c => c.id === id); },

    // ---- tasks ----
    getTasks() { return db.tasks; },
    getTask(id) { return db.tasks.find(t => t.id === id); },
    addTask(task) {
      const t = {
        id: cryptoId(),
        status: "pending",
        pinned: false,
        created_at: Date.now(),
        updated_at: Date.now(),
        ...task,
      };
      db.tasks.unshift(t);
      save(db);
      return t;
    },
    updateTask(id, patch) {
      db.tasks = db.tasks.map(t => t.id === id ? { ...t, ...patch, updated_at: Date.now() } : t);
      save(db);
    },
    deleteTask(id) {
      db.tasks = db.tasks.filter(t => t.id !== id);
      save(db);
    },
    duplicateTask(id) {
      const t = store.getTask(id);
      if (!t) return;
      const copy = { ...t, id: cryptoId(), title: t.title + " (copy)", created_at: Date.now(), status: "pending" };
      db.tasks.unshift(copy);
      save(db);
      return copy;
    },
    toggleComplete(id) {
      const t = store.getTask(id);
      if (!t) return;
      store.updateTask(id, { status: t.status === "completed" ? "pending" : "completed" });
    },
    togglePin(id) {
      const t = store.getTask(id);
      if (!t) return;
      store.updateTask(id, { pinned: !t.pinned });
    },

    // ---- derived ----
    counts() {
      const tasks = db.tasks;
      const today = todayISO(0);
      const isOverdue = t => t.status !== "completed" && t.due_date && t.due_date < today;
      return {
        total: tasks.length,
        completed: tasks.filter(t => t.status === "completed").length,
        pending: tasks.filter(t => t.status === "pending").length,
        overdue: tasks.filter(isOverdue).length,
        today: tasks.filter(t => t.due_date === today).length,
        upcoming: tasks.filter(t => t.due_date > today && t.status !== "completed").length,
      };
    },
    todayISO,
  };

  return { store, todayISO, cryptoId };
})();
