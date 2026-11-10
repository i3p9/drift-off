import { normalizeSettings } from "../settings.js";

export const SAMPLE_RATE = 22050;

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const pick = Math.floor(Math.max(0, Math.min(0.999999999, random())) * (index + 1));
    [result[index], result[pick]] = [result[pick], result[index]];
  }
  return result;
}

export function createPlan(scenes, settings, random = Math.random) {
  const options = normalizeSettings(settings);
  const frames = Math.round(options.minutes * 60 * SAMPLE_RATE);
  const gapFrames = Math.round(options.gap * SAMPLE_RATE);
  const available = scenes.filter(
    (scene) =>
      Number.isFinite(scene.durations?.[options.voice]) && scene.durations[options.voice] > 0,
  );
  if (!available.length) throw new Error("No local scenes are available for this voice.");
  let bag = shuffle(available, random);
  let cursor = Math.round(1.25 * SAMPLE_RATE);
  let previous = null;
  const items = [];
  while (cursor < frames) {
    if (!bag.length) {
      bag = shuffle(available, random);
      if (bag.length > 1 && bag[bag.length - 1].id === previous) {
        [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      }
    }
    const scene = bag.pop();
    const length = Math.round(scene.durations[options.voice] * SAMPLE_RATE);
    // Leave silence at the end rather than cutting off a sentence.
    if (cursor + length > frames) break;
    items.push({ id: scene.id, text: scene.text, startFrame: cursor, frames: length });
    previous = scene.id;
    cursor += length + gapFrames;
  }
  return { settings: options, sampleRate: SAMPLE_RATE, frames, items };
}

export function gainAt(progress, fade = true) {
  const position = Math.max(0, Math.min(1, progress));
  return fade ? 0.16 + 0.84 * Math.pow(1 - position, 1.2) : 1;
}

export function wavHeader(frames, sampleRate = SAMPLE_RATE) {
  if (!Number.isInteger(frames) || frames < 0 || frames * 2 > 0xffffffff - 36) {
    throw new RangeError("Invalid WAV length.");
  }
  const bytes = new Uint8Array(44);
  const view = new DataView(bytes.buffer);
  const writeText = (offset, value) => {
    for (let index = 0; index < value.length; index++)
      bytes[offset + index] = value.charCodeAt(index);
  };
  writeText(0, "RIFF");
  view.setUint32(4, frames * 2 + 36, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, frames * 2, true);
  return bytes;
}

export function pcmForScene(samples, item, plan) {
  const bytes = new Uint8Array(item.frames * 2);
  const view = new DataView(bytes.buffer);
  const edgeFrames = Math.round(plan.sampleRate * 0.008);
  // iOS controls media-element volume through the device. Bake our setting
  // into the track so the app's volume slider also works on iPhones.
  const volume = (plan.settings.volume ?? 100) / 100;
  for (let index = 0; index < item.frames; index++) {
    const sample = samples[index] || 0;
    const gain = gainAt((item.startFrame + index) / plan.frames, plan.settings.fade);
    const edge = Math.min(1, index / edgeFrames, (item.frames - 1 - index) / edgeFrames);
    const value = Math.max(-1, Math.min(1, sample * gain * edge * volume));
    view.setInt16(index * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
  }
  return bytes;
}

export function formatTime(seconds) {
  const value = Math.max(0, Math.ceil(Number(seconds) || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}
