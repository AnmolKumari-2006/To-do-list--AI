/* =========================================================
   TaskPilot AI — Shared shell: sidebar, theme, toasts, task modal
   Include after store.js on every app page (not on login/register).
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  applyTheme(TP.store.getTheme());
  renderUserPill();
  renderSidebarCategories();
  wireThemeToggle();
  wireMobileNav();
  wireAIOrb();
  wireTaskModal();
  highlightActiveNav();
});

/* ---------------- theme ---------------- */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const knob = document.querySelector(".theme-toggle");
  if (knob) knob.setAttribute("aria-checked", theme === "light");
}
function wireThemeToggle() {
  const toggle = document.querySelector(".theme-toggle");
  if (!toggle) return;
  toggle.addEventListener("click", () => {
    const next = TP.store.getTheme() === "dark" ? "light" : "dark";
    TP.store.setTheme(next);
    applyTheme(next);
  });
}

/* ---------------- sidebar ---------------- */
function renderUserPill() {
  const user = TP.store.getUser();
  const pill = document.querySelector(".user-pill");
  if (!pill || !user) return;
  const initials = user.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  pill.querySelector(".avatar").textContent = initials;
  pill.querySelector(".name").textContent = user.name;
  pill.querySelector(".email").textContent = user.email;
}

function renderSidebarCategories() {
  const wrap = document.querySelector(".nav-cats");
  if (!wrap) return;
  const cats = TP.store.getCategories();
  wrap.innerHTML = cats.map(c => `
    <a class="nav-item" href="tasks.html?category=${c.id}">
      <span class="cat-dot" style="background:${c.color}"></span>
      <span>${c.name}</span>
    </a>
  `).join("");
}

function highlightActiveNav() {
  const page = location.pathname.split("/").pop() || "index.html";
  const currentCategory = new URLSearchParams(location.search).get("category");

  // Top-level links (Dashboard, Tasks, Calendar, ...) — match by page only,
  // and only when there's no category filter active.
  document.querySelectorAll(".nav-group > .nav-item[href]").forEach(el => {
    const href = el.getAttribute("href").split("?")[0];
    if (href === page && !currentCategory) el.classList.add("active");
  });

  // Category links — match by page AND category, so only the selected
  // category (if any) gets highlighted, never all of them at once.
  document.querySelectorAll(".nav-cats .nav-item[href]").forEach(el => {
    const url = new URL(el.getAttribute("href"), location.href);
    const linkPage = url.pathname.split("/").pop();
    const linkCategory = url.searchParams.get("category");
    if (linkPage === page && linkCategory === currentCategory) el.classList.add("active");
  });
}

function wireMobileNav() {
  const toggle = document.querySelector(".menu-toggle");
  const sidebar = document.querySelector(".sidebar");
  const scrim = document.querySelector(".scrim");
  if (!toggle || !sidebar) return;
  const open = () => { sidebar.classList.add("open"); scrim?.classList.add("show"); };
  const close = () => { sidebar.classList.remove("open"); scrim?.classList.remove("show"); };
  toggle.addEventListener("click", open);
  scrim?.addEventListener("click", close);
  sidebar.querySelectorAll(".nav-item").forEach(el => el.addEventListener("click", close));
}

/* ---------------- toasts (SweetAlert2 if present, else fallback) ---------------- */
function notify(message, type = "success") {
  if (window.Swal) {
    Swal.fire({
      toast: true, position: "top-end", showConfirmButton: false, timer: 2200, timerProgressBar: true,
      icon: type, title: message, background: "var(--bg-1)", color: "var(--text-hi)",
    });
    return;
  }
  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }
  const el = document.createElement("div");
  el.className = "toast glass";
  el.style.color = type === "error" ? "var(--high)" : type === "info" ? "var(--cyan)" : "var(--low)";
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}

/* ---------------- priority / category helpers (shared across pages) ---------------- */
function priorityBadge(p) {
  const map = { high: ["High", "badge-high"], medium: ["Medium", "badge-medium"], low: ["Low", "badge-low"] };
  const [label, cls] = map[p] || map.medium;
  return `<span class="badge ${cls}"><span class="dot"></span>${label}</span>`;
}
function categoryTag(catId) {
  const c = TP.store.getCategory(catId);
  if (!c) return "";
  return `<span class="cat-tag"><span class="cat-dot" style="background:${c.color}"></span>${c.name}</span>`;
}
function formatDue(dateStr, timeStr) {
  if (!dateStr) return "No due date";
  const today = TP.todayISO(0), tomorrow = TP.todayISO(1);
  let label = dateStr === today ? "Today" : dateStr === tomorrow ? "Tomorrow" : dateStr;
  return timeStr ? `${label} · ${timeStr}` : label;
}

/* ---------------- AI orb + popup ---------------- */
function wireAIOrb() {
  const orb = document.querySelector(".ai-orb");
  const popup = document.querySelector(".ai-popup");
  const scrim = document.querySelector(".ai-popup-scrim");
  if (!orb || !popup) return;

  const open = () => { popup.classList.add("show"); scrim?.classList.add("show"); };
  const close = () => { popup.classList.remove("show"); scrim?.classList.remove("show"); };

  orb.addEventListener("click", open);
  scrim?.addEventListener("click", close);
  popup.querySelector(".ai-popup-close")?.addEventListener("click", close);

  popup.querySelectorAll("[data-ai-tab]").forEach(tab => {
    tab.addEventListener("click", () => {
      popup.querySelectorAll("[data-ai-tab]").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      popup.querySelectorAll("[data-ai-pane]").forEach(p => p.classList.add("hidden"));
      popup.querySelector(`[data-ai-pane="${tab.dataset.aiTab}"]`)?.classList.remove("hidden");
    });
  });

  window.TP_openAI = open;
}

/* ---------------- task add/edit modal (shared) ---------------- */
function wireTaskModal() {
  const scrim = document.getElementById("taskModalScrim");
  if (!scrim) return;
  const modal = scrim.querySelector(".modal");
  const form = document.getElementById("taskForm");
  const catSelect = document.getElementById("taskCategory");

  // populate category select
  if (catSelect) {
    catSelect.innerHTML = TP.store.getCategories().map(c => `<option value="${c.id}">${c.name}</option>`).join("");
  }

  const openers = document.querySelectorAll("[data-open-task-modal]");
  openers.forEach(btn => btn.addEventListener("click", () => openTaskModal()));

  scrim.addEventListener("click", (e) => { if (e.target === scrim) closeTaskModal(); });
  document.getElementById("taskModalClose")?.addEventListener("click", closeTaskModal);
  document.getElementById("taskModalCancel")?.addEventListener("click", closeTaskModal);

  document.querySelectorAll(".priority-opt").forEach(opt => {
    opt.addEventListener("click", () => {
      document.querySelectorAll(".priority-opt").forEach(o => o.classList.remove("active"));
      opt.classList.add("active");
      document.getElementById("taskPriority").value = opt.dataset.value;
    });
  });

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = form.dataset.editingId;
    const payload = {
      title: document.getElementById("taskTitle").value.trim(),
      description: document.getElementById("taskDescription").value.trim(),
      category: document.getElementById("taskCategory").value,
      priority: document.getElementById("taskPriority").value,
      due_date: document.getElementById("taskDueDate").value,
      due_time: document.getElementById("taskDueTime").value,
      reminder_time: document.getElementById("taskReminderTime").value,
    };
    if (!payload.title) { notify("Task title is required", "error"); return; }

    if (id) {
      TP.store.updateTask(id, payload);
      notify("Task updated");
    } else {
      TP.store.addTask(payload);
      notify("Task added");
    }
    closeTaskModal();
    window.dispatchEvent(new CustomEvent("tp:tasks-changed"));
  });
}

function openTaskModal(taskId = null) {
  const scrim = document.getElementById("taskModalScrim");
  const form = document.getElementById("taskForm");
  const title = document.getElementById("taskModalTitle");
  if (!scrim || !form) return;

  form.reset();
  document.querySelectorAll(".priority-opt").forEach(o => o.classList.remove("active"));

  if (taskId) {
    const t = TP.store.getTask(taskId);
    form.dataset.editingId = taskId;
    title.textContent = "Edit task";
    document.getElementById("taskTitle").value = t.title;
    document.getElementById("taskDescription").value = t.description || "";
    document.getElementById("taskCategory").value = t.category;
    document.getElementById("taskDueDate").value = t.due_date || "";
    document.getElementById("taskDueTime").value = t.due_time || "";
    document.getElementById("taskReminderTime").value = t.reminder_time || "";
    document.getElementById("taskPriority").value = t.priority;
    document.querySelector(`.priority-opt[data-value="${t.priority}"]`)?.classList.add("active");
  } else {
    form.dataset.editingId = "";
    title.textContent = "Add task";
    document.getElementById("taskDueDate").value = TP.todayISO(0);
    document.getElementById("taskPriority").value = "medium";
    document.querySelector(`.priority-opt[data-value="medium"]`)?.classList.add("active");
  }
  scrim.classList.add("show");
}
function closeTaskModal() {
  document.getElementById("taskModalScrim")?.classList.remove("show");
}
function editTask(id) { openTaskModal(id); }
function deleteTaskConfirm(id) {
  if (window.Swal) {
    Swal.fire({
      title: "Delete this task?", text: "This can't be undone.", icon: "warning",
      showCancelButton: true, confirmButtonText: "Delete", confirmButtonColor: "#fb5573",
      background: "var(--bg-1)", color: "var(--text-hi)",
    }).then(res => { if (res.isConfirmed) doDelete(id); });
  } else if (confirm("Delete this task?")) {
    doDelete(id);
  }
}
function doDelete(id) {
  TP.store.deleteTask(id);
  notify("Task deleted", "info");
  window.dispatchEvent(new CustomEvent("tp:tasks-changed"));
}
