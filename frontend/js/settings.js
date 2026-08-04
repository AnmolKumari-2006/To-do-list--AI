/* =========================================================
   TaskPilot AI — Settings page
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  renderProfileForm();
  await TP.store.syncFromServer();
  renderCategoryList();
  wireDarkModeSwitch();
  wireAddCategory();
  wireProfileSave();
  wireSwitches();
});

function renderProfileForm() {
  const user = TP.store.getUser();
  const nameEl = document.getElementById("settingsName");
  const emailEl = document.getElementById("settingsEmail");
  if (nameEl) nameEl.value = user?.name || "";
  if (emailEl) emailEl.value = user?.email || "";
}

function renderCategoryList() {
  const wrap = document.getElementById("categoryList");
  if (!wrap) return;
  const cats = TP.store.getCategories();
  wrap.innerHTML = cats.map(c => `
    <div class="cat-edit-row">
      <span class="cat-dot" style="background:${c.color}"></span>
      <span class="name">${c.name}</span>
      <button class="btn-icon" title="Delete" onclick="deleteCategory('${c.id}')"><i class="fa-regular fa-trash-can"></i></button>
    </div>
  `).join("");
}

async function deleteCategory(id) {
  try {
    await TP.store.deleteCategory(id);
    renderCategoryList();
    notify("Category deleted", "info");
  } catch (err) {
    notify(err.message || "Could not delete category", "error");
  }
}

function wireAddCategory() {
  const btn = document.getElementById("addCategoryBtn");
  const input = document.getElementById("newCategoryName");
  const colorInput = document.getElementById("newCategoryColor");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const name = input.value.trim();
    if (!name) { notify("Enter a category name", "error"); return; }
    try {
      await TP.store.addCategory({ name, color: colorInput.value || "#8b6bff", icon: "fa-tag" });
      input.value = "";
      renderCategoryList();
      notify("Category added");
    } catch (err) {
      notify(err.message || "Could not add category", "error");
    }
  });
}

function wireDarkModeSwitch() {
  const sw = document.getElementById("darkModeSwitch");
  if (!sw) return;
  const sync = () => sw.classList.toggle("on", TP.store.getTheme() === "dark");
  sync();
  sw.addEventListener("click", async () => {
    const next = TP.store.getTheme() === "dark" ? "light" : "dark";
    TP.store.setTheme(next);
    applyTheme(next);
    sync();
    try {
      const res = await fetch("/api/auth/profile", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme: next }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.user) TP.store.setUserFromServer(data.user);
    } catch (err) {
      console.warn(err);
    }
  });
}

function wireProfileSave() {
  const btn = document.querySelector("#profile .btn-primary");
  const nameEl = document.getElementById("settingsName");
  if (!btn || !nameEl) return;
  btn.addEventListener("click", async () => {
    const name = nameEl.value.trim();
    if (!name) { notify("Please enter your name", "error"); return; }
    try {
      const res = await fetch("/api/auth/profile", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save profile");
      TP.store.setUserFromServer(data.user);
      renderProfileForm();
      notify("Profile saved");
    } catch (err) {
      notify(err.message || "Could not save profile", "error");
    }
  });
}

function wireSwitches() {
  document.querySelectorAll(".switch[data-pref]").forEach(sw => {
    sw.classList.toggle("on", localStorage.getItem(sw.dataset.pref) !== "off");
    sw.addEventListener("click", () => {
      const isOn = sw.classList.toggle("on");
      localStorage.setItem(sw.dataset.pref, isOn ? "on" : "off");
    });
  });
}
