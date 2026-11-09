(function () {
  "use strict";

  const core = globalThis.DriftCore;
  const catalog = globalThis.DRIFT_CATALOG;
  const byId = id => document.getElementById(id);
  const ui = Object.fromEntries([
    "welcome", "welcome-title", "session", "session-title", "session-eyebrow", "session-guidance",
    "start-button", "start-label", "session-summary", "completion-note", "pause-button", "pause-label",
    "pause-icon", "end-button", "time-left", "session-progress", "playback-state", "status-message",
    "settings-button", "settings-dialog", "duration-select", "gap-select", "voice-select", "fade-toggle",
    "volume-slider", "volume-output", "privacy-button", "privacy-dialog", "reset-settings", "reset-feedback",
    "scene-count", "darken-button", "dark-screen", "home-link",
  ].map(id => [id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), byId(id)]));

  if (!core || !catalog?.scenes?.length) {
    ui.statusMessage.hidden = false;
    ui.statusMessage.textContent = "Some local files are missing. Keep scenes.js, engine.js, and the voices folder beside index.html.";
    ui.startButton.disabled = true;
    return;
  }

  core.configureVoices(catalog.voices);
  ui.voiceSelect.replaceChildren(...catalog.voices.map(voice => Object.assign(document.createElement("option"), { value: voice.id, textContent: voice.label || voice.name })));
  const SETTINGS_KEY = "drift.preferences.v1";
  let settings = { ...core.DEFAULTS };
  try { settings = core.normalizeSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}); } catch { /* Private browsing can disable storage. */ }
  let state = "idle";
  let generation = 0;
  let plan = null;
  let sessionURL = null;
  let previewURL = null;
  const audio = byId("session-audio");
  const voiceLoads = new Map();
  const decoded = new Map();
  let decoder = null;

  function announce(message = "") {
    ui.statusMessage.textContent = message;
    ui.statusMessage.hidden = !message;
  }

  function persistSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Playback never depends on storage. */ }
  }

  function syncSettings() {
    ui.durationSelect.value = String(settings.minutes);
    ui.gapSelect.value = String(settings.gap);
    ui.voiceSelect.value = settings.voice;
    ui.fadeToggle.checked = settings.fade;
    ui.volumeSlider.value = String(settings.volume);
    ui.volumeOutput.value = `${settings.volume}%`;
    const name = catalog.voices.find(voice => voice.id === settings.voice)?.name || catalog.voices[0].name;
    ui.sessionSummary.replaceChildren(
      document.createTextNode(`${settings.minutes} minutes `),
      Object.assign(document.createElement("span"), { textContent: "·" }),
      document.createTextNode(` ${settings.gap}-second pauses `),
      Object.assign(document.createElement("span"), { textContent: "·" }),
      document.createTextNode(` ${name}`),
    );
  }

  function readSettings() {
    settings = core.normalizeSettings({
      minutes: ui.durationSelect.value, gap: ui.gapSelect.value,
      voice: ui.voiceSelect.value, fade: ui.fadeToggle.checked, volume: ui.volumeSlider.value,
    });
    persistSettings();
    syncSettings();
  }

  function setState(next) {
    state = next;
    const active = ["preparing", "ready", "playing", "paused"].includes(state);
    ui.welcome.hidden = active;
    ui.session.hidden = !active;
    ui.settingsButton.disabled = active;
    ui.pauseButton.disabled = state === "preparing";
    ui.pauseLabel.textContent = state === "paused" ? "Resume" : state === "ready" ? "Begin" : "Pause";
    ui.pauseIcon.replaceChildren();
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", ["paused", "ready"].includes(state) ? "m7 4 8 6-8 6V4Z" : "M6 4v12M14 4v12");
    ui.pauseIcon.append(path);
    ui.endButton.textContent = state === "preparing" ? "Cancel" : "End session";
    ui.darkenButton.hidden = !["playing", "paused"].includes(state);
    document.body.classList.toggle("is-active", active);
    document.body.classList.toggle("is-paused", state === "paused");
    if (state === "preparing") {
      ui.sessionEyebrow.textContent = "Making a little room";
      ui.sessionTitle.replaceChildren(document.createTextNode("A quiet moment,"), document.createElement("br"), Object.assign(document.createElement("em"), { textContent: "just for you." }));
      ui.sessionGuidance.textContent = "Your scenes will be ready in a moment.";
      ui.playbackState.textContent = "Preparing your scenes…";
    } else {
      ui.sessionEyebrow.textContent = state === "paused" ? "Take your time" : "Your time to drift";
      ui.sessionTitle.replaceChildren(document.createTextNode("Nothing to do."), document.createElement("br"), Object.assign(document.createElement("em"), { textContent: "Nowhere to be." }));
      ui.sessionGuidance.textContent = state === "paused" ? "Your place is here whenever you’re ready." : state === "ready" ? "Tap Begin when you’re comfortable." : "Close your eyes. Let each scene come and go.";
      ui.playbackState.textContent = state === "paused" ? "Paused" : state === "ready" ? "Ready when you are" : "Playing softly";
    }
    if ("mediaSession" in navigator) {
      try { navigator.mediaSession.playbackState = state === "playing" ? "playing" : state === "paused" ? "paused" : "none"; } catch { /* Not implemented in every browser. */ }
    }
  }

  function loadVoice(voice) {
    if (!core.VOICES.includes(voice)) return Promise.reject(new Error("Unknown local voice."));
    if (globalThis.DRIFT_VOICE_PACKS?.[voice]) return Promise.resolve(globalThis.DRIFT_VOICE_PACKS[voice]);
    if (voiceLoads.has(voice)) return voiceLoads.get(voice);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `voices/${voice}.js`;
      script.onload = () => {
        const pack = globalThis.DRIFT_VOICE_PACKS?.[voice];
        if (pack) resolve(pack);
        else { voiceLoads.delete(voice); reject(new Error("The local voice file is incomplete.")); }
      };
      script.onerror = () => {
        voiceLoads.delete(voice);
        script.remove();
        reject(new Error("The voice file couldn’t be opened. Keep the voices folder beside index.html."));
      };
      document.head.append(script);
    });
    voiceLoads.set(voice, promise);
    return promise;
  }

  async function decodeScene(pack, voice, id) {
    const key = `${voice}:${id}`;
    if (decoded.has(key)) return decoded.get(key);
    const source = pack.clips[id];
    if (!source) throw new Error("A local scene is missing. Please rebuild the voice files.");
    const OfflineContext = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
    if (!OfflineContext) throw new Error("This browser can’t prepare local audio. Please open Drift in a current Chrome, Safari, or Firefox.");
    if (!decoder) decoder = new OfflineContext(1, 1, core.SAMPLE_RATE);
    const binary = atob(source);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    let buffer;
    try { buffer = await decoder.decodeAudioData(bytes.buffer); }
    catch { throw new Error("This browser couldn’t decode the local voice. Please try a current Chrome or Safari."); }
    const samples = new Float32Array(buffer.getChannelData(0));
    decoded.set(key, samples);
    return samples;
  }

  async function composeSession(currentPlan, token) {
    const pack = await loadVoice(currentPlan.settings.voice);
    const pieces = [core.wavHeader(currentPlan.frames)];
    const silence = new Uint8Array(core.SAMPLE_RATE * 2);
    const silentSecond = new Blob([silence]);
    const appendSilence = frames => {
      while (frames >= core.SAMPLE_RATE) { pieces.push(silentSecond); frames -= core.SAMPLE_RATE; }
      if (frames > 0) pieces.push(silence.subarray(0, frames * 2));
    };
    let cursor = 0;
    for (let index = 0; index < currentPlan.items.length; index++) {
      if (token !== generation) return null;
      const item = currentPlan.items[index];
      const samples = await decodeScene(pack, currentPlan.settings.voice, item.id);
      if (token !== generation) return null;
      appendSilence(item.startFrame - cursor);
      pieces.push(core.pcmForScene(samples, item, currentPlan));
      cursor = item.startFrame + item.frames;
      ui.playbackState.textContent = `Preparing your scenes… ${Math.round((index + 1) / currentPlan.items.length * 100)}%`;
      // Yield between clips so Cancel and the progress indicator stay responsive.
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    appendSilence(currentPlan.frames - cursor);
    return new Blob(pieces, { type: "audio/wav" });
  }

  function revokeURLs() {
    if (sessionURL) URL.revokeObjectURL(sessionURL);
    if (previewURL) URL.revokeObjectURL(previewURL);
    sessionURL = previewURL = null;
  }

  function releaseAudio() {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    revokeURLs();
  }

  async function playPrepared() {
    const token = generation;
    try {
      await audio.play();
      if (token !== generation) return;
      setState("playing");
      announce();
    } catch (error) {
      if (token !== generation) return;
      if (error.name === "NotAllowedError") {
        setState("ready");
        announce("Your session is ready. Tap Begin to start the audio.");
      } else {
        stopSession();
        announce("The audio couldn’t start. Please try again, or open Drift in a current Chrome or Safari.");
      }
    }
  }

  async function startSession() {
    if (!["idle", "finished"].includes(state)) return;
    announce();
    ui.completionNote.hidden = true;
    const token = ++generation;
    releaseAudio();
    plan = core.createPlan(catalog.scenes, settings);
    ui.sessionProgress.max = plan.frames / plan.sampleRate;
    ui.sessionProgress.value = 0;
    ui.timeLeft.textContent = core.formatTime(settings.minutes * 60);
    setState("preparing");
    ui.endButton.focus({ preventScroll: true });
    // Unlock this media element during the click, before preparing the audio.
    const silentFrames = Math.round(core.SAMPLE_RATE * 0.2);
    previewURL = URL.createObjectURL(new Blob([core.wavHeader(silentFrames), new Uint8Array(silentFrames * 2)], { type: "audio/wav" }));
    audio.src = previewURL;
    audio.loop = true;
    audio.volume = settings.volume / 100;
    const unlock = audio.play().catch(() => {});
    try {
      const blob = await composeSession(plan, token);
      if (!blob || token !== generation) return;
      await unlock;
      if (token !== generation) return;
      audio.pause();
      audio.loop = false;
      if (previewURL) URL.revokeObjectURL(previewURL);
      previewURL = null;
      sessionURL = URL.createObjectURL(blob);
      audio.src = sessionURL;
      audio.volume = settings.volume / 100;
      await playPrepared();
    } catch (error) {
      if (token !== generation) return;
      stopSession();
      announce(error.message || "The local audio couldn’t be prepared. Please try again.");
    }
  }

  function pauseSession() {
    if (state !== "playing") return;
    audio.pause();
    setState("paused");
  }

  function togglePause() {
    if (state === "playing") pauseSession();
    else if (["paused", "ready"].includes(state)) playPrepared();
  }

  function closeDarkScreen() {
    if (ui.darkScreen.hidden) return;
    ui.darkScreen.hidden = true;
    ui.darkenButton.focus({ preventScroll: true });
  }

  function stopSession(finished = false) {
    ++generation;
    releaseAudio();
    plan = null;
    ui.darkScreen.hidden = true;
    setState(finished ? "finished" : "idle");
    ui.completionNote.hidden = !finished;
    ui.startLabel.textContent = finished ? "Begin another session" : "Begin winding down";
    ui.startButton.focus({ preventScroll: true });
    if ("mediaSession" in navigator) {
      try { navigator.mediaSession.metadata = null; } catch { /* Optional OS integration. */ }
    }
  }

  audio.addEventListener("timeupdate", () => {
    if (!["playing", "paused", "ready"].includes(state) || !plan) return;
    const total = plan.frames / plan.sampleRate;
    ui.sessionProgress.value = Math.min(total, audio.currentTime);
    ui.timeLeft.textContent = core.formatTime(total - audio.currentTime);
    ui.timeLeft.setAttribute("aria-label", `${core.formatTime(total - audio.currentTime)} remaining`);
  });
  audio.addEventListener("ended", () => { if (["playing", "paused"].includes(state)) stopSession(true); });
  audio.addEventListener("pause", () => { if (state === "playing" && !audio.ended) setState("paused"); });
  audio.addEventListener("play", () => { if (["paused", "ready"].includes(state)) setState("playing"); });
  audio.addEventListener("error", () => {
    if (!["playing", "paused", "ready"].includes(state)) return;
    stopSession();
    announce("The local audio couldn’t be played. Please open the complete Drift folder in a current browser.");
  });

  ui.startButton.addEventListener("click", startSession);
  ui.pauseButton.addEventListener("click", togglePause);
  ui.endButton.addEventListener("click", () => { stopSession(); announce(); });
  ui.homeLink.addEventListener("click", event => { event.preventDefault(); if (["idle", "finished"].includes(state)) stopSession(); });
  ui.settingsButton.addEventListener("click", () => { syncSettings(); ui.settingsDialog.showModal(); });
  ui.privacyButton.addEventListener("click", () => { ui.resetFeedback.hidden = true; ui.privacyDialog.showModal(); });
  for (const button of document.querySelectorAll("[data-close]")) button.addEventListener("click", () => byId(button.dataset.close).close());
  for (const dialog of document.querySelectorAll("dialog")) {
    dialog.addEventListener("click", event => {
      const bounds = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
    });
  }
  for (const input of [ui.durationSelect, ui.gapSelect, ui.voiceSelect, ui.fadeToggle]) input.addEventListener("change", readSettings);
  ui.volumeSlider.addEventListener("input", readSettings);
  ui.volumeSlider.addEventListener("change", readSettings);
  ui.settingsDialog.addEventListener("close", readSettings);
  ui.resetSettings.addEventListener("click", () => {
    try { localStorage.removeItem(SETTINGS_KEY); } catch { /* No settings to remove when storage is unavailable. */ }
    settings = { ...core.DEFAULTS };
    syncSettings();
    ui.resetFeedback.hidden = false;
  });
  ui.darkenButton.addEventListener("click", () => { ui.darkScreen.hidden = false; ui.darkScreen.focus({ preventScroll: true }); });
  ui.darkScreen.addEventListener("click", closeDarkScreen);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !ui.darkScreen.hidden) { closeDarkScreen(); return; }
    if (event.code !== "Space" || document.querySelector("dialog[open]") || /^(INPUT|SELECT|TEXTAREA|BUTTON|A)$/.test(event.target.tagName)) return;
    event.preventDefault();
    if (["idle", "finished"].includes(state)) startSession();
    else togglePause();
  });
  window.addEventListener("pagehide", () => {
    ++generation;
    releaseAudio();
    plan = null;
    ui.darkScreen.hidden = true;
    setState("idle");
  });

  if ("mediaSession" in navigator) {
    const handlers = { play: () => { if (["paused", "ready"].includes(state)) playPrepared(); }, pause: pauseSession, stop: () => stopSession() };
    for (const [action, handler] of Object.entries(handlers)) {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* OS controls are optional. */ }
    }
  }

  ui.sceneCount.textContent = `${catalog.scenes.length} original scenes. ${catalog.voices.length === 1 ? "One voice" : `${catalog.voices.length} voices`}.`;
  syncSettings();
  setState("idle");
})();
