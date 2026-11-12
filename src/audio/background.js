import { BACKGROUNDS } from "../data/backgrounds.js";

export function backgroundUrl(id) {
  const sound = BACKGROUNDS.find((sound) => sound.id === id);
  if (!sound) throw new Error("Unknown background sound.");
  if (!sound.file) return null;
  return (import.meta.env?.BASE_URL || "/") + "audio/" + sound.file;
}

export function backgroundEnvelope(frame, frames, sampleRate) {
  if (frames <= 1) return 0;
  const fadeIn = Math.min(sampleRate * 1.5, frames / 4);
  const fadeOut = Math.min(sampleRate * 15, frames / 4);
  return Math.max(0, Math.min(1, frame / fadeIn, (frames - 1 - frame) / fadeOut));
}
