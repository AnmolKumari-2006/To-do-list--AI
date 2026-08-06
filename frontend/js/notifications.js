document.addEventListener("DOMContentLoaded", async () => {
  const authenticated = await ensureAuthenticated();
  if (!authenticated) return;
  applyTheme(TP.store.getTheme());
  renderUserPill();
  await TP.store.syncFromServer();
  renderNotificationList();
  wireThemeToggle();
  wireMobileNav();
  highlightActiveNav();
});

async function fetchNotifications() {
  try {
    const res = await fetch("/api/notifications", { credentials: "same-origin" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.notifications || [];
  } catch (err) {
    console.error("Failed to load notifications", err);
    return [];
  }
}

async function renderNotificationList() {
  const items = document.getElementById("notificationItems");
  const empty = document.getElementById("notificationEmpty");
  if (!items || !empty) return;

  const notifications = await fetchNotifications();
  if (!notifications.length) {
    items.innerHTML = "";
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";
  items.innerHTML = notifications.map(notification => {
    const timeLabel = notification.remind_at ? new Date(notification.remind_at).toLocaleString() : "Unknown time";
    const message = notification.message || "Task reminder";
    const statusClass = notification.status === "sent" ? "note-sent" : "note-pending";
    return `
      <div class="notification-card ${statusClass}">
        <div class="notification-head">
          <strong>${message}</strong>
          <span class="notification-status">${notification.status === "sent" ? "Sent" : "Pending"}</span>
        </div>
        <div class="notification-time">${timeLabel}</div>
      </div>
    `;
  }).join("");
}
