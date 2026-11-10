import "./styles.css";
import catalog from "./data/scenes.json" with { type: "json" };
import {
  GAPS,
  MINUTES,
  loadSettings,
  normalizeSettings,
  resetSettings,
  saveSettings,
} from "./settings.js";
import { formatTime } from "./audio/session.js";
import { createPlayer } from "./audio/player.js";
import { initializeInstall } from "./install.js";

const byId = (id) => document.getElementById(id);
const ui = {
  welcome: byId("welcome"),
  session: byId("session"),
  heading: byId("session-title"),
  eyebrow: byId("session-eyebrow"),
  guidance: byId("session-guidance"),
  start: byId("start-button"),
  startLabel: byId("start-label"),
  summary: byId("session-summary"),
  completion: byId("completion-note"),
  pause: byId("pause-button"),
  pauseLabel: byId("pause-label"),
  pausePath: document.querySelector("#pause-icon path"),
  end: byId("end-button"),
  time: byId("time-left"),
  progress: byId("session-progress"),
  playback: byId("playback-state"),
  message: byId("status-message"),
  settings: byId("settings-button"),
  settingsDialog: byId("settings-dialog"),
  duration: byId("duration-select"),
  gap: byId("gap-select"),
  voice: byId("voice-select"),
  fade: byId("fade-toggle"),
  volume: byId("volume-slider"),
  volumeOutput: byId("volume-output"),
  about: byId("privacy-button"),
  aboutDialog: byId("privacy-dialog"),
  reset: byId("reset-settings"),
  resetFeedback: byId("reset-feedback"),
  darken: byId("darken-button"),
  darkScreen: byId("dark-screen"),
  home: byId("home-link"),
};

let settings = loadSettings();
const player = createPlayer(byId("session-audio"), {
  onStateChange: renderState,
  onProgress: renderProgress,
  onError: announce,
});

function announce(message = "") {
  ui.message.textContent = message;
  ui.message.hidden = !message;
}

function fillSelect(select, options) {
  select.replaceChildren(...options.map(({ value, label }) => new Option(label, value)));
}

fillSelect(
  ui.duration,
  MINUTES.map((value) => ({ value, label: value + " minutes" })),
);
fillSelect(
  ui.gap,
  GAPS.map((value) => ({ value, label: value + " seconds" })),
);
fillSelect(
  ui.voice,
  catalog.voices.map((voice) => ({ value: voice.id, label: voice.name })),
);

function syncSettings() {
  ui.duration.value = String(settings.minutes);
  ui.gap.value = String(settings.gap);
  ui.voice.value = settings.voice;
  ui.fade.checked = settings.fade;
  ui.volume.value = String(settings.volume);
  ui.volumeOutput.value = settings.volume + "%";
  const voice = catalog.voices.find((voice) => voice.id === settings.voice);
  ui.summary.textContent =
    settings.minutes + " minutes · " + settings.gap + "-second pauses · " + voice.name;
}

function readSettings() {
  settings = normalizeSettings({
    minutes: ui.duration.value,
    gap: ui.gap.value,
    voice: ui.voice.value,
    fade: ui.fade.checked,
    volume: ui.volume.value,
  });
  saveSettings(settings);
  syncSettings();
}

function setHeading(firstLine, secondLine) {
  const emphasis = document.createElement("em");
  emphasis.textContent = secondLine;
  ui.heading.replaceChildren(
    document.createTextNode(firstLine),
    document.createElement("br"),
    emphasis,
  );
}

function renderState(state, plan) {
  const active = ["preparing", "ready", "playing", "paused"].includes(state);
  ui.welcome.hidden = active;
  ui.session.hidden = !active;
  ui.settings.disabled = active;
  ui.pause.disabled = state === "preparing";
  ui.pauseLabel.textContent = state === "paused" ? "Resume" : state === "ready" ? "Begin" : "Pause";
  ui.pausePath.setAttribute(
    "d",
    ["paused", "ready"].includes(state) ? "m7 4 8 6-8 6V4Z" : "M6 4v12M14 4v12",
  );
  ui.end.textContent = state === "preparing" ? "Cancel" : "End session";
  ui.darken.hidden = !["playing", "paused"].includes(state);
  document.body.classList.toggle("is-active", active);
  document.body.classList.toggle("is-paused", state === "paused");

  if (state === "preparing") {
    announce();
    ui.completion.hidden = true;
    ui.progress.max = plan.frames / plan.sampleRate;
    ui.progress.value = 0;
    ui.time.textContent = formatTime(ui.progress.max);
    ui.eyebrow.textContent = "Making a little room";
    setHeading("A quiet moment,", "just for you.");
    ui.guidance.textContent = "Your scenes will be ready in a moment.";
    ui.playback.textContent = "Preparing your scenes…";
    ui.end.focus({ preventScroll: true });
  } else if (active) {
    ui.eyebrow.textContent = state === "paused" ? "Take your time" : "Your time to drift";
    setHeading("Nothing to do.", "Nowhere to be.");
    ui.guidance.textContent =
      state === "paused"
        ? "Your place is here whenever you’re ready."
        : state === "ready"
          ? "Tap Begin when you’re comfortable."
          : "Close your eyes. Let each scene come and go.";
    ui.playback.textContent =
      state === "paused" ? "Paused" : state === "ready" ? "Ready when you are" : "Playing softly";
    if (state === "playing") announce();
  } else {
    ui.darkScreen.hidden = true;
    ui.completion.hidden = state !== "finished";
    ui.startLabel.textContent =
      state === "finished" ? "Begin another session" : "Begin winding down";
    if (state === "finished") ui.start.focus({ preventScroll: true });
  }
}

function renderProgress({ preparing, duration, position }) {
  if (preparing !== undefined) {
    ui.playback.textContent = "Preparing your scenes… " + Math.round(preparing * 100) + "%";
    return;
  }
  ui.progress.value = position;
  ui.time.textContent = formatTime(duration - position);
  ui.time.setAttribute("aria-label", formatTime(duration - position) + " remaining");
}

function closeDarkScreen() {
  ui.darkScreen.hidden = true;
  ui.darken.focus({ preventScroll: true });
}

ui.start.addEventListener("click", () => player.start(settings));
ui.pause.addEventListener("click", () => player.togglePause());
ui.end.addEventListener("click", () => {
  player.stop();
  announce();
  ui.start.focus({ preventScroll: true });
});
ui.home.addEventListener("click", (event) => {
  event.preventDefault();
  if (["idle", "finished"].includes(player.state)) player.stop();
});
ui.settings.addEventListener("click", () => {
  syncSettings();
  ui.settingsDialog.showModal();
});
ui.about.addEventListener("click", () => {
  ui.resetFeedback.hidden = true;
  ui.aboutDialog.showModal();
});

for (const button of document.querySelectorAll("[data-close]")) {
  button.addEventListener("click", () => byId(button.dataset.close).close());
}
for (const dialog of document.querySelectorAll("dialog")) {
  dialog.addEventListener("click", (event) => {
    const bounds = dialog.getBoundingClientRect();
    const outside =
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom;
    if (event.target === dialog && outside) dialog.close();
  });
}
for (const input of [ui.duration, ui.gap, ui.voice, ui.fade])
  input.addEventListener("change", readSettings);
ui.volume.addEventListener("input", readSettings);
ui.settingsDialog.addEventListener("close", readSettings);
ui.reset.addEventListener("click", () => {
  settings = resetSettings();
  syncSettings();
  ui.resetFeedback.hidden = false;
});
ui.darken.addEventListener("click", () => {
  ui.darkScreen.hidden = false;
  ui.darkScreen.focus({ preventScroll: true });
});
ui.darkScreen.addEventListener("click", closeDarkScreen);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !ui.darkScreen.hidden) {
    closeDarkScreen();
    return;
  }
  if (
    event.code !== "Space" ||
    document.querySelector("dialog[open]") ||
    /^(INPUT|SELECT|TEXTAREA|BUTTON|A)$/.test(event.target.tagName)
  )
    return;
  event.preventDefault();
  if (["idle", "finished"].includes(player.state)) player.start(settings);
  else player.togglePause();
});

// Stop decorative motion in the background without touching audio playback.
document.addEventListener("visibilitychange", () => {
  document.body.classList.toggle("is-hidden", document.hidden);
});

byId("scene-count").textContent = catalog.scenes.length + " original scenes. Two voices.";
initializeInstall();
syncSettings();
renderState("idle", null);
