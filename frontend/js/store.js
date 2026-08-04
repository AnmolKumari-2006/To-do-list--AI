/* =========================================================
   TaskPilot AI — Backend-backed store
   The frontend now reads/writes through the Flask API so
   each signed-in account only sees its own data.
   ========================================================= */

const TP = (function () {
  const LS_KEY = "taskpilot_v1";

  function todayISO(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  }

  function load() {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) {
      const seed = { user: null, theme: "dark", categories: [], tasks: [] };
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

  async function fetchJson(url, options = {}) {
    const res = await fetch(url, { credentials: "same-origin", ...options });
    if (res.status === 401) {
      const authPages = ["/login.html", "/register.html", "/"];
      if (!authPages.some(page => window.location.pathname.endsWith(page))) {
        db.user = null;
        db.categories = [];
        db.tasks = [];
        save(db);
        window.location.href = "/login.html";
      }
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Not logged in.");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  const store = {
    getTheme() { return db.theme || "dark"; },
    setTheme(t) { db.theme = t; save(db); },

    getUser() { return db.user; },
    setUserFromServer(user) {
      db.user = user;
      if (user?.theme) db.theme = user.theme;
      save(db);
    },
    clearUser() { db.user = null; db.categories = []; db.tasks = []; save(db); },

    getCategories() { return db.categories; },
    getCategory(id) { return db.categories.find(c => String(c.id) === String(id)); },

    async syncFromServer() {
      try {
        const [catData, taskData] = await Promise.all([
          fetchJson("/api/categories"),
          fetchJson("/api/tasks"),
        ]);
        db.categories = (catData.categories || []).map(c => ({ ...c, id: Number(c.id) }));
        db.tasks = (taskData.tasks || []).map(t => ({ ...t, id: Number(t.id), category: t.category ?? null }));
        save(db);
        return { categories: db.categories, tasks: db.tasks };
      } catch (err) {
        console.error(err);
        return { categories: db.categories, tasks: db.tasks };
      }
    },

    async addCategory(payload) {
      const data = await fetchJson("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const category = { ...data.category, id: Number(data.category.id) };
      db.categories.push(category);
      save(db);
      return category;
    },

    async deleteCategory(id) {
      await fetchJson(`/api/categories/${id}`, { method: "DELETE" });
      db.categories = db.categories.filter(c => String(c.id) !== String(id));
      db.tasks = db.tasks.map(t => String(t.category) === String(id) ? { ...t, category: null } : t);
      save(db);
    },

    async addTask(task) {
      const data = await fetchJson("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(task) });
      const created = { ...data.task, id: Number(data.task.id), category: data.task.category ?? null };
      db.tasks.unshift(created);
      save(db);
      return created;
    },

    async updateTask(id, patch) {
      const data = await fetchJson(`/api/tasks/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const updated = { ...data.task, id: Number(data.task.id), category: data.task.category ?? null };
      db.tasks = db.tasks.map(t => String(t.id) === String(id) ? updated : t);
      save(db);
      return updated;
    },

    async deleteTask(id) {
      await fetchJson(`/api/tasks/${id}`, { method: "DELETE" });
      db.tasks = db.tasks.filter(t => String(t.id) !== String(id));
      save(db);
    },

    async duplicateTask(id) {
      const source = db.tasks.find(t => String(t.id) === String(id));
      if (!source) return null;
      const copy = await store.addTask({ ...source, title: `${source.title} (copy)`, status: "pending" });
      return copy;
    },

    async toggleComplete(id) {
      const task = db.tasks.find(t => String(t.id) === String(id));
      if (!task) return;
      return store.updateTask(id, { status: task.status === "completed" ? "pending" : "completed" });
    },

    async togglePin(id) {
      const task = db.tasks.find(t => String(t.id) === String(id));
      if (!task) return;
      return store.updateTask(id, { pinned: !task.pinned });
    },

    getTasks() { return db.tasks; },
    getTask(id) { return db.tasks.find(t => String(t.id) === String(id)); },

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

  return { store, todayISO, cryptoId: () => Math.random().toString(36).slice(2, 10) };
})();
