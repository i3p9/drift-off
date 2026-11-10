import test from "node:test";
import assert from "node:assert/strict";
import { createPlayer } from "../src/audio/player.js";
import { DEFAULTS } from "../src/settings.js";
import { wavHeader } from "../src/audio/session.js";

class FakeAudio extends EventTarget {
  paused = true;
  ended = false;
  currentTime = 0;
  loop = false;
  src = "";
  plays = 0;
  denyPlayback = false;

  async play() {
    this.plays++;
    if (this.denyPlayback && this.plays > 1) {
      const error = new Error("A tap is needed.");
      error.name = "NotAllowedError";
      throw error;
    }
    this.paused = false;
    queueMicrotask(() => this.dispatchEvent(new Event("play")));
  }

  pause() {
    this.paused = true;
    queueMicrotask(() => this.dispatchEvent(new Event("pause")));
  }

  removeAttribute(name) {
    if (name === "src") this.src = "";
  }

  load() {
    this.currentTime = 0;
  }
}

function setup(t, options = {}) {
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const handlers = {};
  const mediaSession = {
    metadata: null,
    playbackState: "none",
    setActionHandler(action, handler) {
      handlers[action] = handler;
    },
    setPositionState(position) {
      this.position = position;
    },
  };
  const audioSession = { type: "auto" };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { mediaSession, audioSession },
  });
  t.after(() => Object.defineProperty(globalThis, "navigator", previousNavigator));
  const audio = new FakeAudio();
  const states = [];
  const progress = [];
  const errors = [];
  const player = createPlayer(audio, {
    onStateChange: (state) => states.push(state),
    onProgress: (value) => progress.push(value),
    onError: (message) => errors.push(message),
    compose: async (plan) => new Blob([wavHeader(plan.frames)]),
    ...options,
  });
  t.after(() => player.stop());
  return { audio, player, states, progress, errors, handlers, mediaSession, audioSession };
}

test("one native track owns playback, position, and lock-screen pause/resume", async (t) => {
  const { audio, player, states, progress, handlers, mediaSession, audioSession } = setup(t);
  await player.start(DEFAULTS);
  assert.equal(player.state, "playing");
  assert.equal(audio.loop, false);
  assert.equal(audio.volume, 1);
  assert.match(audio.src, /^blob:/);
  assert.equal(audioSession.type, "playback");
  assert.deepEqual(states, ["preparing", "ready", "playing"]);

  audio.currentTime = 41;
  audio.dispatchEvent(new Event("timeupdate"));
  assert.equal(progress.at(-1).position, 41);
  assert.equal(mediaSession.position.duration, 420);
  handlers.pause();
  assert.equal(player.state, "paused");
  await handlers.play();
  assert.equal(player.state, "playing");
  assert.equal(audio.currentTime, 41);
  handlers.seekto({ seekTime: 500 });
  assert.equal(audio.currentTime, 420);
  handlers.stop();
  assert.equal(player.state, "idle");
  assert.equal(audio.src, "");
  assert.equal(audioSession.type, "auto");
  assert.equal(mediaSession.playbackState, "none");
});

test("cancelled preparation cannot start audio after its work completes", async (t) => {
  let finish;
  const { player, audio, states } = setup(t, {
    compose: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const starting = player.start(DEFAULTS);
  player.stop();
  finish(new Blob([wavHeader(100)]));
  await starting;
  assert.equal(player.state, "idle");
  assert.equal(audio.src, "");
  assert.deepEqual(states, ["preparing", "idle"]);
});

test("phone autoplay restrictions leave a prepared track ready for another tap", async (t) => {
  const { player, audio, errors } = setup(t);
  audio.denyPlayback = true;
  await player.start(DEFAULTS);
  assert.equal(player.state, "ready");
  assert.match(errors.at(-1), /Tap Begin/);
  audio.denyPlayback = false;
  await player.resume();
  assert.equal(player.state, "playing");
});

test("natural completion releases audio and returns to the quiet finished state", async (t) => {
  const { player, audio, audioSession } = setup(t);
  await player.start(DEFAULTS);
  audio.ended = true;
  audio.dispatchEvent(new Event("ended"));
  assert.equal(player.state, "finished");
  assert.equal(audio.src, "");
  assert.equal(audioSession.type, "auto");
});

test("a preparation failure restores the controls instead of leaving a silent player", async (t) => {
  const { player, errors } = setup(t, {
    compose: async () => {
      throw new Error("Narration is unavailable.");
    },
  });
  await player.start(DEFAULTS);
  assert.equal(player.state, "idle");
  assert.deepEqual(errors, ["Narration is unavailable."]);
});
