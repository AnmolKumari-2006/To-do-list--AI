/* =========================================================
   TaskPilot AI — Auth pages (mocked; wire to Flask on Day 5)
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  applyTheme(TP.store.getTheme());

  const loginForm = document.getElementById("loginForm");
  loginForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    // TODO(Day 5): POST /api/auth/login { email, password }
    window.location.href = "index.html";
  });

  const registerForm = document.getElementById("registerForm");
  registerForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("regName").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    if (name && email) {
      const db = TP.store.getUser();
      db.name = name; db.email = email;
    }
    // TODO(Day 5): POST /api/auth/register { name, email, password }
    window.location.href = "index.html";
  });
});
