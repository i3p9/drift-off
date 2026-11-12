import planetSvg from "./assets/planet.svg?raw";

let motionPreference;

export function syncArtworkMotion() {
  const reduced = motionPreference.matches;
  const paused = reduced || document.hidden || document.body.classList.contains("is-paused");
  document.body.classList.toggle("is-hidden", document.hidden);
  document.getElementById("motion-note").hidden = !reduced;
  for (const svg of document.querySelectorAll("[data-planet] svg")) {
    if (paused) svg.pauseAnimations();
    else svg.unpauseAnimations();
  }
}

export function initializeBrand() {
  document.querySelectorAll("[data-planet]").forEach((slot, index) => {
    // This markup is our own SVG asset. Each copy needs unique path and gradient IDs.
    slot.innerHTML = planetSvg.replaceAll("drift-", "drift-" + index + "-");
    if (slot.classList.contains("planet-scene")) {
      slot.querySelector("svg").setAttribute("viewBox", "0 15 128 98");
    }
  });

  motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  motionPreference.addEventListener("change", syncArtworkMotion);
  // Only decorative animation pauses when the app is hidden; audio keeps playing.
  document.addEventListener("visibilitychange", syncArtworkMotion);
  syncArtworkMotion();
}
