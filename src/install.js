import { registerSW } from "virtual:pwa-register";

export function initializeInstall() {
  const button = document.getElementById("install-button");
  const dialog = document.getElementById("install-dialog");
  const statusMessages = document.querySelectorAll("[data-offline-status]");
  const standalone = window.matchMedia("(display-mode: standalone)");
  let installPrompt = null;

  function updateButton() {
    button.hidden = standalone.matches || navigator.standalone === true;
  }

  function setStatus(message, ready = false) {
    for (const status of statusMessages) {
      status.textContent = message;
      status.classList.toggle("is-ready", ready);
    }
  }

  function offlineReady() {
    setStatus("Saved for offline use. Both voices and background sounds are ready.", true);
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    button.hidden = true;
    dialog.close();
  });
  standalone.addEventListener("change", updateButton);
  button.addEventListener("click", async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
    } else {
      dialog.showModal();
    }
  });
  updateButton();

  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    registerSW({
      immediate: true,
      onOfflineReady: offlineReady,
      onRegisteredSW(_url, registration) {
        if (registration?.active) offlineReady();
      },
      onRegisterError() {
        setStatus("Offline saving is unavailable here. You can still listen while connected.");
      },
    });
  } else {
    setStatus("Open the hosted app to save it for offline use.");
  }
}
