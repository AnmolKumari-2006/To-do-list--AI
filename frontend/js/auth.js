/* =========================================================
   TaskPilot AI — Auth pages
   Real Flask session auth. Errors are shown inline with notify().
   ========================================================= */

// Auth pages don't load app.js (it assumes a logged-in shell), so provide
// a minimal theme helper and toast fallback here instead of duplicating SweetAlert2 wiring.
function notify(message, type = "success") {
  if (window.Swal) {
    Swal.fire({
      toast: true,
      position: "top-end",
      showConfirmButton: false,
      timer: 2600,
      timerProgressBar: true,
      icon: type,
      title: message,
      background: "var(--bg-1)",
      color: "var(--text-hi)",
    });
    return;
  }
  alert(message);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

async function redirectIfAuthenticated() {
  try {
    const res = await fetch("/api/auth/me", { credentials: "same-origin" });
    if (res.ok) {
      window.location.href = "index.html";
    }
  } catch (err) {
    // ignore: user is not authenticated or server unavailable
  }
}

function createSubmitHandler(endpoint, payloadFactory) {
  return async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn) submitBtn.disabled = true;

    try {
      const payload = payloadFactory();
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "Something went wrong. Please try again.", "error");
        if (submitBtn) submitBtn.disabled = false;
        return;
      }
      TP.store.setUserFromServer(data.user);
      window.location.href = "index.html";
    } catch (err) {
      notify("Couldn't reach the server. Is the Flask app running?", "error");
      if (submitBtn) submitBtn.disabled = false;
      console.error(err);
    }
  };
}

async function initAuthPage() {
  if (typeof TP === "undefined" || !TP.store) {
    console.warn("TP.store is unavailable; auth page may not function correctly.");
  }

  applyTheme(TP?.store?.getTheme?.() || "dark");
  await redirectIfAuthenticated();

  if (new URLSearchParams(location.search).get("error") === "google_failed") {
    notify("Google sign-in didn't complete. Please try again.", "error");
  }

  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", createSubmitHandler("/api/auth/login", () => ({
      email: document.getElementById("loginEmail").value.trim(),
      password: document.getElementById("loginPassword").value,
    })));
  }

  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", createSubmitHandler("/api/auth/register", () => ({
      name: document.getElementById("regName").value.trim(),
      email: document.getElementById("regEmail").value.trim(),
      password: document.getElementById("regPassword").value,
    })));
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAuthPage);
} else {
  initAuthPage();
}
