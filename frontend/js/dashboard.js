/* =========================================================
   TaskPilot AI — Dashboard rendering
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  renderGreeting();
  await TP.store.syncFromServer();
  renderDashStats();
  renderTodayList();
  renderProgressRing();
  renderAIRecommendation();
  wireQuickAdd();
});

window.addEventListener("tp:tasks-changed", async () => {
  await TP.store.syncFromServer();
  renderDashStats();
  renderTodayList();
  renderProgressRing();
  renderAIRecommendation();
});

window.addEventListener("tp:time-updated", () => {
  renderDashStats();
  renderTodayList();
  renderProgressRing();
  renderAIRecommendation();
});

function renderGreeting() {
  const el = document.getElementById("greetingName");
  if (!el) return;
  const user = TP.store.getUser();
  const hour = new Date().getHours();
  const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const name = user?.name ? user.name.split(" ")[0] : "there";
  el.textContent = `Good ${part}, ${name}`;
}

function renderDashStats() {
  const c = TP.store.counts();
  const cards = [
    { id: "dToday", val: c.today, icon: "fa-sun", color: "#22d3ee" },
    { id: "dPending", val: c.pending, icon: "fa-hourglass-half", color: "#8b6bff" },
    { id: "dCompleted", val: c.completed, icon: "fa-circle-check", color: "#2fd18f" },
    { id: "dOverdue", val: c.overdue, icon: "fa-triangle-exclamation", color: "#fb5573" },
    { id: "dUpcoming", val: c.upcoming, icon: "fa-calendar-days", color: "#f6a723" },
  ];
  cards.forEach(c2 => {
    const num = document.querySelector(`#${c2.id} .num`);
    if (num) num.textContent = c2.val;
  });
}

function renderTodayList() {
  const wrap = document.getElementById("todayTaskList");
  if (!wrap) return;
  const today = TP.todayISO(0);
  const tasks = TP.store.getTasks()
    .filter(t => t.due_date === today)
    .sort((a, b) => (a.status === "completed") - (b.status === "completed"));

  if (!tasks.length) {
    wrap.innerHTML = `<div class="empty-state"><i class="fa-regular fa-square-check"></i><div class="t">No tasks due today</div><p>Add one or enjoy the clear schedule.</p></div>`;
    return;
  }
  wrap.innerHTML = tasks.map(t => `
    <div class="task-row ${t.status === "completed" ? "done" : ""}">
      <div class="check ${t.status === "completed" ? "done" : ""}" onclick="(async()=>{await TP.store.toggleComplete('${t.id}'); window.dispatchEvent(new CustomEvent('tp:tasks-changed'));})()"><i class="fa-solid fa-check"></i></div>
      <div class="body" onclick="editTask('${t.id}')" style="cursor:pointer;">
        <div class="t-title">${t.title}</div>
        <div class="t-meta">${categoryTag(t.category)}<span>·</span>${priorityBadge(t.priority)}${t.due_time ? `<span>· ${t.due_time}</span>` : ""}</div>
      </div>
    </div>
  `).join("");
}

function renderProgressRing() {
  const c = TP.store.counts();
  const pct = c.total ? Math.round((c.completed / c.total) * 100) : 0;
  const svg = document.getElementById("progressRingCircle");
  const label = document.getElementById("progressRingPct");
  if (label) label.textContent = pct + "%";
  if (svg) {
    const r = 54, circumference = 2 * Math.PI * r;
    svg.style.strokeDasharray = circumference;
    svg.style.strokeDashoffset = circumference - (pct / 100) * circumference;
  }
}

function renderAIRecommendation() {
  const box = document.getElementById("dashAIRec");
  if (!box) return;
  const task = pickAdviceTask ? pickAdviceTask() : null;
  if (!task) {
    box.innerHTML = `<p>All caught up — no pending tasks need attention right now.</p>`;
    return;
  }
  box.innerHTML = `<p><strong>${task.title}</strong> next — it has the nearest deadline${task.priority === "high" ? " and high priority" : ""}. Tackling it first keeps the rest of your day on track.</p>`;
}

function wireQuickAdd() {
  const input = document.getElementById("quickAddInput");
  const btn = document.getElementById("quickAddBtn");
  if (!input || !btn) return;
  const submit = async () => {
    const title = input.value.trim();
    if (!title) return;
    try {
      const category = TP.store.getCategories()[0]?.id || null;
      await TP.store.addTask({ title, category, priority: "medium", due_date: TP.todayISO(0) });
      input.value = "";
      notify("Task added");
      window.dispatchEvent(new CustomEvent("tp:tasks-changed"));
    } catch (err) {
      notify(err.message || "Could not create task", "error");
    }
  };
  btn.addEventListener("click", submit);
  input.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
}
