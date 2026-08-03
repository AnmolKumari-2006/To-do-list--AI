/* =========================================================
   TaskPilot AI — Statistics charts (Chart.js)
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  if (!window.Chart) return;
  renderStatCards();
  renderPieChart();
  renderBarChart();
});

function isDark() { return document.documentElement.getAttribute("data-theme") !== "light"; }
function axisColor() { return isDark() ? "#aab1cc" : "#565b7d"; }
function gridColor() { return isDark() ? "rgba(255,255,255,.06)" : "rgba(20,22,50,.06)"; }

function renderStatCards() {
  const c = TP.store.counts();
  const map = { statTotal: c.total, statCompleted: c.completed, statPending: c.pending, statOverdue: c.overdue };
  Object.entries(map).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  });
}

function renderPieChart() {
  const el = document.getElementById("priorityPieChart");
  if (!el) return;
  const tasks = TP.store.getTasks();
  const counts = { high: 0, medium: 0, low: 0 };
  tasks.forEach(t => counts[t.priority] !== undefined && counts[t.priority]++);

  new Chart(el, {
    type: "doughnut",
    data: {
      labels: ["High", "Medium", "Low"],
      datasets: [{
        data: [counts.high, counts.medium, counts.low],
        backgroundColor: ["#fb5573", "#f6a723", "#2fd18f"],
        borderWidth: 0,
      }],
    },
    options: {
      cutout: "68%",
      plugins: { legend: { position: "bottom", labels: { color: axisColor(), boxWidth: 10, padding: 16, font: { family: "Inter" } } } },
    },
  });
}

function renderBarChart() {
  const el = document.getElementById("weeklyBarChart");
  if (!el) return;
  const tasks = TP.store.getTasks();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const dayLabels = days.map(d => new Date(d).toLocaleDateString(undefined, { weekday: "short" }));
  const completedPerDay = days.map(d => tasks.filter(t => t.status === "completed" && t.due_date === d).length);
  const createdPerDay = days.map(d => tasks.filter(t => t.due_date === d).length);

  new Chart(el, {
    type: "bar",
    data: {
      labels: dayLabels,
      datasets: [
        { label: "Created", data: createdPerDay, backgroundColor: "rgba(139,107,255,.35)", borderRadius: 6, maxBarThickness: 22 },
        { label: "Completed", data: completedPerDay, backgroundColor: "#22d3ee", borderRadius: 6, maxBarThickness: 22 },
      ],
    },
    options: {
      scales: {
        x: { grid: { display: false }, ticks: { color: axisColor(), font: { family: "Inter" } } },
        y: { beginAtZero: true, ticks: { stepSize: 1, color: axisColor() }, grid: { color: gridColor() } },
      },
      plugins: { legend: { position: "bottom", labels: { color: axisColor(), boxWidth: 10, padding: 16, font: { family: "Inter" } } } },
    },
  });
}
