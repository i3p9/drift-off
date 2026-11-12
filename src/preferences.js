export function initializePreferences({ button, dialog, closeButton, heading, onOpen }) {
  const mobile = window.matchMedia("(max-width: 680px)");
  const homePath = import.meta.env?.BASE_URL || "/";
  const preferencesPath = homePath + "preferences";
  const homeTitle = document.title;
  let returningHome = false;

  function isPreferencesPage() {
    return window.location.pathname.replace(/\/$/, "") === preferencesPath;
  }

  function show() {
    if (dialog.open) return;
    onOpen();
    dialog.showModal();
    dialog.querySelector(".settings-content").scrollTop = 0;
    // Start at the screen title instead of highlighting an action or slider.
    heading.focus({ preventScroll: true });
  }

  function hide() {
    if (!dialog.open) return;
    dialog.close();
    button.focus({ preventScroll: true });
  }

  function syncRoute() {
    returningHome = false;
    document.title = isPreferencesPage() ? "Preferences · Drift" : homeTitle;
    if (isPreferencesPage()) show();
    else hide();
  }

  function open() {
    if (mobile.matches && !isPreferencesPage()) {
      window.history.pushState({ driftPreferences: true }, "", preferencesPath);
      document.title = "Preferences · Drift";
    }
    show();
  }

  function close() {
    if (returningHome) return;
    if (isPreferencesPage() && window.history.state?.driftPreferences) {
      // Return to the original entry, including its query, hash, and scroll position.
      returningHome = true;
      window.history.back();
    } else {
      // A direct link has no app-created entry to go back to.
      if (isPreferencesPage()) window.history.replaceState(null, "", homePath);
      document.title = homeTitle;
      hide();
    }
  }

  button.addEventListener("click", open);
  closeButton.addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener("click", (event) => {
    const bounds = dialog.getBoundingClientRect();
    const outside =
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom;
    if (event.target === dialog && outside) close();
  });
  window.addEventListener("popstate", syncRoute);
  mobile.addEventListener("change", () => {
    if (dialog.open && mobile.matches) open();
  });
  syncRoute();
}
