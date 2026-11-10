import catalog from "../data/scenes.json" with { type: "json" };
import { composeSession } from "./compose.js";
import { createPlan, SAMPLE_RATE, wavHeader } from "./session.js";
import { createMediaControls, setAudioSession } from "./media-session.js";

export function createPlayer(
  audio,
  { onStateChange, onProgress, onError, compose = composeSession },
) {
  let state = "idle";
  let plan = null;
  let generation = 0;
  let sessionUrl = null;
  let unlockUrl = null;

  function setState(next) {
    if (state === next) return;
    state = next;
    onStateChange(state, plan);
    updateProgress();
  }

  function releaseAudio() {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    if (sessionUrl) URL.revokeObjectURL(sessionUrl);
    if (unlockUrl) URL.revokeObjectURL(unlockUrl);
    sessionUrl = unlockUrl = null;
  }

  function updateProgress() {
    if (!plan || state === "preparing") return;
    const duration = plan.frames / plan.sampleRate;
    const position = Math.min(duration, audio.currentTime || 0);
    onProgress({ duration, position });
    controls.update({
      state,
      duration,
      position,
      voice: catalog.voices.find((voice) => voice.id === plan.settings.voice).name,
    });
  }

  function stop(finished = false) {
    generation++;
    // Change state before pause/load events arrive from the media element.
    plan = null;
    setState(finished ? "finished" : "idle");
    releaseAudio();
    controls.clear();
    setAudioSession("auto");
  }

  async function resume() {
    if (!["paused", "ready"].includes(state)) return;
    const token = generation;
    setAudioSession("playback");
    try {
      await audio.play();
      if (token === generation) setState("playing");
    } catch (error) {
      if (token !== generation) return;
      if (error.name === "NotAllowedError") {
        setState("ready");
        onError("Your scenes are ready. Tap Begin to start the audio.");
      } else {
        stop();
        onError("The audio could not start. Please try again.");
      }
    }
  }

  function pause() {
    if (state !== "playing") return;
    audio.pause();
    setState("paused");
  }

  function seek(position) {
    if (!plan || !["playing", "paused"].includes(state)) return;
    audio.currentTime = Math.max(0, Math.min(position, plan.frames / plan.sampleRate));
    updateProgress();
  }

  const controls = createMediaControls({ play: resume, pause, stop, seek });

  async function start(settings) {
    if (!["idle", "finished"].includes(state)) return;
    const token = ++generation;
    releaseAudio();
    plan = createPlan(catalog.scenes, settings);
    setState("preparing");
    setAudioSession("playback");

    // Unlock this same media element during the user's tap, before decoding.
    const frames = Math.round(SAMPLE_RATE * 0.2);
    unlockUrl = URL.createObjectURL(
      new Blob([wavHeader(frames), new Uint8Array(frames * 2)], { type: "audio/wav" }),
    );
    audio.src = unlockUrl;
    audio.loop = true;
    audio.volume = 1;
    const unlocked = audio.play().catch(() => {});

    try {
      const blob = await compose(plan, {
        isCancelled: () => token !== generation,
        onProgress: (progress) => {
          if (token === generation) onProgress({ preparing: progress });
        },
      });
      if (!blob || token !== generation) return;
      await unlocked;
      if (token !== generation) return;
      audio.pause();
      audio.loop = false;
      URL.revokeObjectURL(unlockUrl);
      unlockUrl = null;
      sessionUrl = URL.createObjectURL(blob);
      audio.src = sessionUrl;
      setState("ready");
      await resume();
    } catch (error) {
      if (token !== generation) return;
      stop();
      onError(error.message || "Your scenes could not be prepared. Please try again.");
    }
  }

  audio.addEventListener("timeupdate", updateProgress);
  audio.addEventListener("loadedmetadata", updateProgress);
  audio.addEventListener("ended", () => {
    if (["playing", "paused"].includes(state)) stop(true);
  });
  audio.addEventListener("pause", () => {
    if (state === "playing" && audio.paused && !audio.ended) setState("paused");
  });
  audio.addEventListener("play", () => {
    if (["paused", "ready"].includes(state) && !audio.paused) setState("playing");
  });
  audio.addEventListener("error", () => {
    if (!["playing", "paused", "ready"].includes(state)) return;
    stop();
    onError("Playback was interrupted. Please start a new session.");
  });

  return {
    start,
    pause,
    resume,
    stop,
    get state() {
      return state;
    },
    togglePause() {
      return state === "playing" ? pause() : resume();
    },
  };
}
