/* =========================================================
   TaskPilot AI — Auth pages
   Real Flask session auth (Day 5). Errors are shown inline
   with notify() so the user knows *why* it failed.
   ========================================================= */

// Auth pages don't load app.js (it assumes a logged-in shell), so provide
// a minimal toast fallback here instead of duplicating SweetAlert2 wiring.
function notify(message, type = "success") {
  if (window.Swal) {
    Swal.fire({
      toast: true, position: "top-end", showConfirmButton: false, timer: 2600, timerProgressBar: true,
      icon: type, title: message, background: "var(--bg-1)", color: "var(--text-hi)",
    });
    return;
  }
  alert(message);
}

document.addEventListener("DOMContentLoaded", async () => {
  applyTheme(TP.store.getTheme());
  await redirectIfAuthenticated();

  if (new URLSearchParams(location.search).get("error") === "google_failed") {
    notify("Google sign-in didn't complete. Please try again.", "error");
  }

  const loginForm = document.getElementById("loginForm");
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const submitBtn = loginForm.querySelector("button[type=submit]");

    submitBtn.disabled = true;
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "Login failed. Please try again.", "error");
        submitBtn.disabled = false;
        return;
      }
      TP.store.setUserFromServer(data.user);
      window.location.href = "index.html";
    } catch (err) {
      notify("Couldn't reach the server. Is the Flask app running?", "error");
      submitBtn.disabled = false;
    }
  });

  const registerForm = document.getElementById("registerForm");
  registerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("regName").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPassword").value;
    const submitBtn = registerForm.querySelector("button[type=submit]");

    submitBtn.disabled = true;
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "Registration failed. Please try again.", "error");
        submitBtn.disabled = false;
        return;
      }
      TP.store.setUserFromServer(data.user);
      window.location.href = "index.html";
    } catch (err) {
      notify("Couldn't reach the server. Is the Flask app running?", "error");
      submitBtn.disabled = false;
    }
  });
});