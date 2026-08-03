/* =========================================================
   TaskPilot AI — Calendar (Month view only, per scope)
   ========================================================= */

let calState = { year: null, month: null, selected: null };

document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("calGrid");
  if (!grid) return;

  const now = new Date();
  calState.year = now.getFullYear();
  calState.month = now.getMonth();
  calState.selected = TP.todayISO(0);

  document.getElementById("calPrev")?.addEventListener("click", () => shiftMonth(-1));
  document.getElementById("calNext")?.addEventListener("click", () => shiftMonth(1));

  renderCalendar();
});

function shiftMonth(delta) {
  calState.month += delta;
  if (calState.month < 0) { calState.month = 11; calState.year--; }
  if (calState.month > 11) { calState.month = 0; calState.year++; }
  renderCalendar();
}

function renderCalendar() {
  const { year, month } = calState;
  const label = document.getElementById("calLabel");
  if (label) {
    label.textContent = new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const tasks = TP.store.getTasks();
  const cats = TP.store.getCategories();
  const catColor = id => (cats.find(c => c.id === id) || {}).color || "#8b6bff";

  const cells = [];
  for (let i = firstDow - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, muted: true, iso: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, muted: false, iso });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: cells.length, muted: true, iso: null });
  }

  const todayIso = TP.todayISO(0);
  const grid = document.getElementById("calGrid");
  grid.innerHTML = cells.map(c => {
    if (!c.iso) return `<div class="cal-cell muted-cell"><span class="d-num">${c.day}</span></div>`;
    const dayTasks = tasks.filter(t => t.due_date === c.iso);
    const dots = dayTasks.slice(0, 4).map(t => `<span style="background:${catColor(t.category)}"></span>`).join("");
    const classes = ["cal-cell"];
    if (c.iso === todayIso) classes.push("today");
    if (c.iso === calState.selected) classes.push("selected");
    return `<div class="${classes.join(" ")}" onclick="selectCalDay('${c.iso}')">
      <span class="d-num">${c.day}</span>
      <div class="cal-dots">${dots}</div>
    </div>`;
  }).join("");

  renderDayPanel();
}

function selectCalDay(iso) {
  calState.selected = iso;
  renderCalendar();
}

function renderDayPanel() {
  const panel = document.getElementById("dayPanelList");
  const heading = document.getElementById("dayPanelHeading");
  if (!panel) return;

  const iso = calState.selected;
  if (heading) {
    const d = new Date(iso + "T00:00:00");
    heading.textContent = d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  }

  const dayTasks = TP.store.getTasks().filter(t => t.due_date === iso);
  if (!dayTasks.length) {
    panel.innerHTML = `<div class="empty-state"><i class="fa-regular fa-calendar-check"></i><div class="t">Nothing scheduled</div><p>This day is wide open.</p></div>`;
    return;
  }
  panel.innerHTML = dayTasks.map(t => `
    <div class="task-row ${t.status === "completed" ? "done" : ""}">
      <div class="check ${t.status === "completed" ? "done" : ""}" onclick="TP.store.toggleComplete('${t.id}'); renderCalendar();"><i class="fa-solid fa-check"></i></div>
      <div class="body">
        <div class="t-title">${t.title}</div>
        <div class="t-meta">${categoryTag(t.category)}<span>·</span>${priorityBadge(t.priority)}${t.due_time ? `<span>· ${t.due_time}</span>` : ""}</div>
      </div>
    </div>
  `).join("");
}
