/* =========================================================
   TaskPilot AI — Task Management page
   ========================================================= */

let taskFilters = { search: "", status: "all", priority: "all", sort: "due_date" };

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(location.search);
  if (params.get("category")) taskFilters.category = params.get("category");

  wireSearch();
  wireChips();
  wireSort();
  initSortable();
  renderTaskList();
});

window.addEventListener("tp:tasks-changed", renderTaskList);

function wireSearch() {
  const input = document.getElementById("taskSearch");
  if (!input) return;
  input.addEventListener("input", () => { taskFilters.search = input.value.toLowerCase(); renderTaskList(); });
}

function wireChips() {
  document.querySelectorAll(".chip[data-filter]").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip[data-filter]").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      const [key, val] = chip.dataset.filter.split(":");
      taskFilters[key] = val;
      renderTaskList();
    });
  });
}

function wireSort() {
  const sel = document.getElementById("sortSelect");
  if (!sel) return;
  sel.addEventListener("change", () => { taskFilters.sort = sel.value; renderTaskList(); });
}

function initSortable() {
  const list = document.getElementById("taskListWrap");
  if (!list || !window.Sortable) return;
  Sortable.create(list, {
    handle: ".grip",
    animation: 180,
    ghostClass: "sortable-ghost",
    onEnd: () => notify("Task order updated", "info"),
  });
}

function getFilteredTasks() {
  let tasks = [...TP.store.getTasks()];
  const today = TP.todayISO(0);

  if (taskFilters.category) tasks = tasks.filter(t => t.category === taskFilters.category);
  if (taskFilters.search) tasks = tasks.filter(t =>
    t.title.toLowerCase().includes(taskFilters.search) ||
    (t.description || "").toLowerCase().includes(taskFilters.search) ||
    (TP.store.getCategory(t.category)?.name || "").toLowerCase().includes(taskFilters.search)
  );

  switch (taskFilters.status) {
    case "completed": tasks = tasks.filter(t => t.status === "completed"); break;
    case "pending": tasks = tasks.filter(t => t.status === "pending"); break;
    case "today": tasks = tasks.filter(t => t.due_date === today); break;
    case "upcoming": tasks = tasks.filter(t => t.due_date > today); break;
  }
  if (taskFilters.priority && taskFilters.priority !== "all") {
    tasks = tasks.filter(t => t.priority === taskFilters.priority);
  }

  const weight = { high: 3, medium: 2, low: 1 };
  switch (taskFilters.sort) {
    case "priority": tasks.sort((a, b) => weight[b.priority] - weight[a.priority]); break;
    case "name": tasks.sort((a, b) => a.title.localeCompare(b.title)); break;
    case "recent": tasks.sort((a, b) => b.created_at - a.created_at); break;
    default: tasks.sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"));
  }
  // pinned always float to top
  tasks.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  return tasks;
}

function renderTaskList() {
  const wrap = document.getElementById("taskListWrap");
  if (!wrap) return;
  const tasks = getFilteredTasks();

  if (!tasks.length) {
    wrap.innerHTML = `<div class="empty-state"><i class="fa-regular fa-clipboard"></i><div class="t">No tasks match</div><p>Try clearing filters or add a new task.</p></div>`;
    return;
  }

  wrap.innerHTML = tasks.map(t => `
    <div class="task-card glass ${t.status === "completed" ? "done" : ""} ${t.pinned ? "pinned" : ""}" data-id="${t.id}">
      <div class="grip"><i class="fa-solid fa-grip-vertical"></i></div>
      <div class="check ${t.status === "completed" ? "done" : ""}" onclick="TP.store.toggleComplete('${t.id}'); window.dispatchEvent(new CustomEvent('tp:tasks-changed'));"><i class="fa-solid fa-check"></i></div>
      <div class="content">
        <div class="row1">
          <div class="t-title">${t.pinned ? '<i class="fa-solid fa-thumbtack" style="font-size:11px;color:var(--violet);margin-right:6px;"></i>' : ""}${t.title}</div>
        </div>
        ${t.description ? `<div class="t-desc">${t.description}</div>` : ""}
        <div class="t-meta">
          ${categoryTag(t.category)}
          ${priorityBadge(t.priority)}
          <span><i class="fa-regular fa-clock"></i> ${formatDue(t.due_date, t.due_time)}</span>
        </div>
      </div>
      <div class="actions">
        <button class="btn-icon" title="Pin" onclick="TP.store.togglePin('${t.id}'); window.dispatchEvent(new CustomEvent('tp:tasks-changed'));"><i class="fa-solid fa-thumbtack"></i></button>
        <button class="btn-icon" title="Duplicate" onclick="TP.store.duplicateTask('${t.id}'); window.dispatchEvent(new CustomEvent('tp:tasks-changed'));"><i class="fa-regular fa-copy"></i></button>
        <button class="btn-icon" title="Edit" onclick="editTask('${t.id}')"><i class="fa-regular fa-pen-to-square"></i></button>
        <button class="btn-icon" title="Delete" onclick="deleteTaskConfirm('${t.id}')"><i class="fa-regular fa-trash-can"></i></button>
      </div>
    </div>
  `).join("");
}
