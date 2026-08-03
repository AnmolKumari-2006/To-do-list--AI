/* =========================================================
   TaskPilot AI — AI popup interactions (mocked for frontend phase)
   Replace the setTimeout blocks with real fetch() calls to
   /api/ai/advise and /api/ai/plan once the Flask + Gemini
   backend is wired up (Day 12-15).
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  wireAskAI();
  wireDailyPlanner();
});

function pickAdviceTask() {
  const tasks = TP.store.getTasks().filter(t => t.status !== "completed");
  if (!tasks.length) return null;
  const weight = { high: 3, medium: 2, low: 1 };
  return [...tasks].sort((a, b) => {
    const dueA = a.due_date || "9999", dueB = b.due_date || "9999";
    if (dueA !== dueB) return dueA < dueB ? -1 : 1;
    return (weight[b.priority] || 0) - (weight[a.priority] || 0);
  })[0];
}

function wireAskAI() {
  const btn = document.getElementById("askAIBtn");
  const resultBox = document.getElementById("aiAdviceResult");
  if (!btn || !resultBox) return;

  btn.addEventListener("click", () => {
    resultBox.innerHTML = `<div class="ai-loading"><span class="spinner"></span>Gemini is reviewing your tasks…</div>`;
    btn.disabled = true;

    setTimeout(() => {
      const task = pickAdviceTask();
      btn.disabled = false;
      if (!task) {
        resultBox.innerHTML = `<div class="ai-result">All caught up — no pending tasks to prioritize. 🎉</div>`;
        return;
      }
      const cat = TP.store.getCategory(task.category);
      resultBox.innerHTML = `
        <div class="ai-result">
          <div class="rec-title">${task.title}</div>
          <p class="muted" style="margin-bottom:8px;">${categoryTag(task.category)} &nbsp; ${priorityBadge(task.priority)}</p>
          <p>Recommended first because it has the ${task.priority === "high" ? "highest priority and " : ""}nearest deadline${task.due_date ? " (" + formatDue(task.due_date, task.due_time) + ")" : ""}. Finishing it first clears your biggest risk of a missed deadline today.</p>
        </div>`;
    }, 900);
  });
}

function wireDailyPlanner() {
  const btn = document.getElementById("generatePlanBtn");
  const resultBox = document.getElementById("aiPlanResult");
  if (!btn || !resultBox) return;

  btn.addEventListener("click", () => {
    resultBox.innerHTML = `<div class="ai-loading"><span class="spinner"></span>Building today's plan…</div>`;
    btn.disabled = true;

    setTimeout(() => {
      btn.disabled = false;
      const today = TP.todayISO(0);
      const tasks = TP.store.getTasks()
        .filter(t => t.status !== "completed" && (t.due_date === today || !t.due_date))
        .sort((a, b) => (a.due_time || "23:59").localeCompare(b.due_time || "23:59"))
        .slice(0, 4);

      if (!tasks.length) {
        resultBox.innerHTML = `<div class="ai-result">No tasks due today — enjoy the breathing room.</div>`;
        return;
      }

      let cursor = 9 * 60; // 9:00 in minutes
      const slots = tasks.map(t => {
        const dur = t.priority === "high" ? 90 : t.priority === "medium" ? 60 : 45;
        const start = cursor, end = cursor + dur;
        cursor = end + 15; // 15 min buffer
        return { t, start, end };
      });

      const fmt = (m) => {
        const h = Math.floor(m / 60), mm = m % 60;
        const ampm = h >= 12 ? "PM" : "AM";
        const hh = ((h + 11) % 12) + 1;
        return `${hh}:${String(mm).padStart(2, "0")} ${ampm}`;
      };

      resultBox.innerHTML = `<div class="ai-result">
        ${slots.map(s => `
          <div class="plan-slot">
            <div class="time">${fmt(s.start)}–${fmt(s.end)}</div>
            <div>
              <div style="font-weight:700;">${s.t.title}</div>
              <div class="muted" style="font-size:12px;">${categoryTag(s.t.category)}</div>
            </div>
          </div>
        `).join("")}
      </div>`;
    }, 1000);
  });
}

/* Preview of an AI-personalized reminder message, shown in the task modal
   once reminder_time is set — mirrors the "generate at save time" design. */
function previewReminderMessage(task) {
  if (!task.reminder_time) return "";
  return `Hi! "${task.title}" is due ${formatDue(task.due_date, task.due_time).toLowerCase()}. Starting now will help you finish on time.`;
}
