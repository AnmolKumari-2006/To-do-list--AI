/* =========================================================
   TaskPilot AI — Shared shell: sidebar, theme, toasts, task modal
   Include after store.js on every app page (not on login/register).
   ========================================================= */

document.addEventListener("DOMContentLoaded", initApp);

async function initApp() {
  const authenticated = await ensureAuthenticated();
  if (!authenticated) return;

  applyTheme(TP.store.getTheme());
  renderUserPill();
  await TP.store.syncFromServer();
  wireThemeToggle();
  wireMobileNav();
  wireAIOrb();
  wireTaskModal();
  highlightActiveNav();
  renderOnboardingHint();
  wireTimeRefresh();
  wireReminderPolling();
}

function wireTimeRefresh() {
  setInterval(() => window.dispatchEvent(new CustomEvent("tp:time-updated")), 30000);
}

async function fetchDueNotifications() {
  try {
    const res = await fetch("/api/notifications/due", { credentials: "same-origin" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.notifications || [];
  } catch (err) {
    console.error("Failed to fetch reminders", err);
    return [];
  }
}

function isReminderAlertsEnabled() {
  return localStorage.getItem("reminder-alerts") !== "off";
}

function isReminderSoundEnabled() {
  return localStorage.getItem("reminder-sound") !== "off";
}

function playReminderSound() {
  if (!window.AudioContext && !window.webkitAudioContext) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const context = new AudioCtx();
    const now = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.02, now + 0.45);

    const frequencies = [440, 660, 880];
    const oscillators = frequencies.map(freq => {
      const osc = context.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.45);
      return osc;
    });

    gain.connect(context.destination);
    setTimeout(() => {
      context.close().catch(() => {});
    }, 500);
  } catch (err) {
    console.warn("Reminder sound failed", err);
  }
}

function updateNotificationBadge(count) {
  const badge = document.querySelector('.nav-item[href="notifications.html"] .nav-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count;
    badge.classList.add("show");
  } else {
    badge.textContent = "";
    badge.classList.remove("show");
  }
}

function presentReminderNotification(notification) {
  if (!isReminderAlertsEnabled()) return;
  const timeLabel = notification.remind_at ? new Date(notification.remind_at).toLocaleString() : "";
  const taskTitle = notification.message?.replace(/^Reminder:\s*/, "") || "Your task";
  const title = "Task Reminder";
  const body = `
    <strong>${taskTitle}</strong>
    <div style="font-size:0.88rem; color:var(--text-mid); margin-top:8px; line-height:1.4;">
      Your task is due soon. Please complete it before the deadline.${timeLabel ? ` <span style="display:block; margin-top:4px;">${timeLabel}</span>` : ""}
    </div>
  `;
  if (window.Swal) {
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "info",
      title,
      html: body,
      showConfirmButton: false,
      timer: 9000,
      timerProgressBar: true,
      background: "var(--bg-1)",
      color: "var(--text-hi)",
      customClass: { popup: "reminder-toast" },
    });
  } else {
    notify(`Your task is due soon. Complete ${taskTitle} before the deadline.${timeLabel ? ` (${timeLabel})` : ""}`, "info");
  }
  if (isReminderSoundEnabled()) playReminderSound();
}

async function checkReminders() {
  const notifications = await fetchDueNotifications();
  updateNotificationBadge(notifications.length);
  if (!notifications.length) return;
  notifications.forEach(presentReminderNotification);
}

function wireReminderPolling() {
  checkReminders();
  setInterval(checkReminders, 60000);
}

async function ensureAuthenticated() {
  try {
    const res = await fetch("/api/auth/me", { credentials: "same-origin" });
    if (!res.ok) {
      TP.store.clearUser();
      location.href = "/login.html";
      return false;
    }
    const data = await res.json();
    if (data.user) {
      TP.store.setUserFromServer(data.user);
      return true;
    }
  } catch (err) {
    TP.store.clearUser();
    location.href = "/login.html";
    return false;
  }
  TP.store.clearUser();
  location.href = "/login.html";
  return false;
}

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

async function confirmLogout() {
  if (window.Swal) {
    const result = await Swal.fire({
      title: "Confirm Logout",
      text: "Are you sure you want to log out?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Logout",
      cancelButtonText: "Cancel",
      reverseButtons: true,
      background: "var(--bg-1)",
      color: "var(--text-hi)",
    });
    return result.isConfirmed;
  }
  return window.confirm("Are you sure you want to log out?");
}

async function logoutUser() {
  const confirmed = await confirmLogout();
  if (!confirmed) return;

  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
  } catch (err) {
    console.warn(err);
  }
  TP.store.clearUser();
  location.href = "/login.html";
}

function renderOnboardingHint() {
  const user = TP.store.getUser();
  if (!user || location.pathname.includes("tasks.html") || location.pathname.includes("calendar.html") || location.pathname.includes("statistics.html") || location.pathname.includes("settings.html")) return;
  const welcomeKey = `taskpilot_welcome_seen:${user.id}`;
  const hasSeenWelcome = localStorage.getItem(welcomeKey);
  if (hasSeenWelcome) return;

  const welcome = document.createElement("div");
  welcome.className = "glass card";
  welcome.style.marginBottom = "20px";
  welcome.innerHTML = `
    <div class="section-head"><h3>Welcome to TaskPilot AI</h3><button class="btn-icon" onclick="this.parentElement.parentElement.remove(); localStorage.setItem('${welcomeKey}','true')"><i class="fa-solid fa-xmark"></i></button></div>
    <p class="muted" style="margin:0 0 10px;">Start by adding your first task, organizing categories, and using the dashboard to track progress.</p>
    <div class="chip">Getting started</div>
    <div class="chip">Create tasks</div>
    <div class="chip">Track progress</div>
  `;

  const main = document.querySelector(".main");
  if (main) {
    main.insertBefore(welcome, main.firstChild.nextSibling);
    localStorage.setItem(welcomeKey, "true");
  }
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

function formatReminderSummary(date, time) {
  if (!date || !time) return "No reminder set";
  const parsed = new Date(`${date}T${time}`);
  if (Number.isNaN(parsed.getTime())) return "Reminder set";
  const dateLabel = parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const timeLabel = parsed.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `Reminder set: ${dateLabel} • ${timeLabel}`;
}

function setReminderUI() {
  const reminderSummary = document.getElementById("reminderSummary");
  if (!reminderSummary) return;
  const reminderDateInput = document.getElementById("taskReminderDate");
  const reminderTimeInput = document.getElementById("taskReminderTime");
  const date = reminderDateInput?.value || "";
  const time = reminderTimeInput?.value || "";
  reminderSummary.textContent = formatReminderSummary(date, time);
  if (date || time) {
    reminderSummary.classList.add("has-reminder");
    reminderSummary.setAttribute("aria-label", "Reminder set");
  } else {
    reminderSummary.classList.remove("has-reminder");
    reminderSummary.setAttribute("aria-label", "No reminder set");
  }
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

  const closeBtn = document.getElementById("taskModalClose");
  const cancelBtn = document.getElementById("taskModalCancel");
  closeBtn?.addEventListener("click", closeTaskModal);
  cancelBtn?.addEventListener("click", closeTaskModal);
  scrim.addEventListener("click", (event) => {
    if (event.target === scrim) closeTaskModal();
  });

  const reminderSummary = document.getElementById("reminderSummary");
  const addReminderBtn = document.getElementById("addReminderBtn");
  const reminderPicker = document.getElementById("reminderPicker");
  const reminderDateInput = document.getElementById("taskReminderDate");
  const reminderTimeInput = document.getElementById("taskReminderTime");
  const clearReminderBtn = document.getElementById("clearReminderBtn");

  addReminderBtn?.addEventListener("click", () => {
    reminderPicker?.classList.remove("hidden");
    reminderDateInput?.focus();
  });
  reminderDateInput?.addEventListener("change", setReminderUI);
  reminderTimeInput?.addEventListener("change", setReminderUI);
  clearReminderBtn?.addEventListener("click", () => {
    if (reminderDateInput) reminderDateInput.value = "";
    if (reminderTimeInput) reminderTimeInput.value = "";
    setReminderUI();
  });

  document.querySelectorAll(".priority-opt").forEach(opt => {
    opt.addEventListener("click", () => {
      document.querySelectorAll(".priority-opt").forEach(o => o.classList.remove("active"));
      opt.classList.add("active");
      document.getElementById("taskPriority").value = opt.dataset.value;
    });
  });

  setReminderUI();

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = form.dataset.editingId;
    const reminderDate = document.getElementById("taskReminderDate").value;
    const reminderTime = document.getElementById("taskReminderTime").value;
    if ((reminderDate && !reminderTime) || (!reminderDate && reminderTime)) {
      notify("Please select both reminder date and time.", "error");
      return;
    }
    const dueDate = document.getElementById("taskDueDate").value;
    const dueTime = document.getElementById("taskDueTime").value;
    if (reminderDate && reminderTime && dueDate) {
      const dueValue = new Date(`${dueDate}T${dueTime || "23:59"}`);
      const reminderValue = new Date(`${reminderDate}T${reminderTime}`);
      if (Number.isNaN(dueValue.getTime()) || Number.isNaN(reminderValue.getTime()) || reminderValue > dueValue) {
        notify("Reminder must be at or before the task due date and time.", "error");
        return;
      }
    }

    const payload = {
      title: document.getElementById("taskTitle").value.trim(),
      description: document.getElementById("taskDescription").value.trim(),
      category: document.getElementById("taskCategory").value || null,
      priority: document.getElementById("taskPriority").value,
      due_date: document.getElementById("taskDueDate").value,
      due_time: document.getElementById("taskDueTime").value,
      reminder_time: reminderDate && reminderTime ? `${reminderDate}T${reminderTime}` : null,
    };
    if (!payload.title) { notify("Task title is required", "error"); return; }

    try {
      if (id) {
        await TP.store.updateTask(id, payload);
        notify("Task updated");
      } else {
        await TP.store.addTask(payload);
        notify("Task added");
      }
      closeTaskModal();
      window.dispatchEvent(new CustomEvent("tp:tasks-changed"));
    } catch (err) {
      notify(err.message || "Could not save task", "error");
    }
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
    const reminder = parseReminderValue(t.reminder_time, t.due_date);
    document.getElementById("taskReminderDate").value = reminder?.date || "";
    document.getElementById("taskReminderTime").value = reminder?.time || "";
    document.getElementById("taskPriority").value = t.priority;
    document.querySelector(`.priority-opt[data-value="${t.priority}"]`)?.classList.add("active");
  } else {
    form.dataset.editingId = "";
    title.textContent = "Add task";
    document.getElementById("taskDueDate").value = TP.todayISO(0);
    document.getElementById("taskPriority").value = "medium";
    document.getElementById("taskReminderDate").value = "";
    document.getElementById("taskReminderTime").value = "";
    document.querySelector(`.priority-opt[data-value="medium"]`)?.classList.add("active");
  }
  document.getElementById("reminderPicker")?.classList.add("hidden");
  setReminderUI();
  scrim.classList.add("show");
}

function parseReminderValue(raw, fallbackDate = null) {
  if (!raw) return null;
  if (raw.includes("T") || raw.includes(" ")) {
    const [datePart, timePart] = raw.replace(" ", "T").split("T");
    if (!datePart || !timePart) return null;
    return { date: datePart, time: timePart.slice(0, 5) };
  }
  if (/^\d{2}:\d{2}$/.test(raw)) {
    return { date: fallbackDate || "", time: raw };
  }
  return null;
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
async function doDelete(id) {
  try {
    await TP.store.deleteTask(id);
    notify("Task deleted", "info");
    window.dispatchEvent(new CustomEvent("tp:tasks-changed"));
  } catch (err) {
    notify(err.message || "Could not delete task", "error");
  }
}
