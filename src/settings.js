import catalog from "./data/scenes.json" with { type: "json" };

export const MINUTES = [3, 5, 7, 10, 15, 20, 30];
export const GAPS = [8, 10, 12, 14, 18, 22];
export const VOICES = catalog.voices.map((voice) => voice.id);
export const DEFAULTS = {
  minutes: 7,
  gap: 14,
  fade: true,
  voice: VOICES[0],
  volume: 65,
};

const STORAGE_KEY = "drift.preferences.v1";

export function normalizeSettings(input = {}) {
  if (!input || typeof input !== "object") input = {};
  const hasVolume =
    (typeof input.volume === "number" ||
      (typeof input.volume === "string" && input.volume.trim() !== "")) &&
    Number.isFinite(Number(input.volume));

  return {
    minutes: MINUTES.includes(Number(input.minutes)) ? Number(input.minutes) : DEFAULTS.minutes,
    gap: GAPS.includes(Number(input.gap)) ? Number(input.gap) : DEFAULTS.gap,
    fade: typeof input.fade === "boolean" ? input.fade : DEFAULTS.fade,
    voice: VOICES.includes(input.voice) ? input.voice : DEFAULTS.voice,
    volume: hasVolume ? Math.max(0, Math.min(100, Number(input.volume))) : DEFAULTS.volume,
  };
}

export function loadSettings() {
  try {
    return normalizeSettings(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeSettings(settings)));
  } catch {
    // Listening still works when browser storage is unavailable.
  }
}

export function resetSettings() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // There is nothing to clear when storage is unavailable.
  }
  return { ...DEFAULTS };
}
