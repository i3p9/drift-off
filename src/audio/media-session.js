export function setAudioSession(type) {
  try {
    if ("audioSession" in navigator) navigator.audioSession.type = type;
  } catch {
    // Audio Session is optional; the native audio element remains the player.
  }
}

export function createMediaControls({ play, pause, stop, seek }) {
  const media = navigator.mediaSession;
  if (!media) return { update() {}, clear() {} };

  const handlers = {
    play,
    pause,
    stop,
    seekto: (details) => seek(details.seekTime),
  };
  for (const [action, handler] of Object.entries(handlers)) {
    try {
      media.setActionHandler(action, handler);
    } catch {
      // Browsers expose different sets of lock-screen controls.
    }
  }

  return {
    update({ state, voice, duration, position }) {
      if (typeof MediaMetadata !== "undefined" && !media.metadata) {
        media.metadata = new MediaMetadata({
          title: "Time to drift",
          artist: voice,
          album: "Drift · bedtime scenes",
          artwork: [{ src: "/icons/planet-512.png", sizes: "512x512", type: "image/png" }],
        });
      }
      media.playbackState = state === "playing" ? "playing" : "paused";
      if (typeof media.setPositionState === "function" && duration > 0) {
        try {
          media.setPositionState({
            duration,
            playbackRate: 1,
            position: Math.max(0, Math.min(position, duration)),
          });
        } catch {
          // Some browsers need loaded metadata before accepting a position.
        }
      }
    },
    clear() {
      media.metadata = null;
      media.playbackState = "none";
      try {
        media.setPositionState?.();
      } catch {
        /* No position to clear. */
      }
    },
  };
}
