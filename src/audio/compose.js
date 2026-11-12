import { VOICES } from "../settings.js";
import { SAMPLE_RATE, pcmForScene, wavHeader } from "./session.js";
import { backgroundUrl } from "./background.js";

let loadedVoice = null;
let voicePromise = null;
let decoder = null;
const decodedClips = new Map();
const backgroundLoads = new Map();

export function voiceUrl(voice) {
  if (!VOICES.includes(voice) || !/^[a-z][a-z0-9-]{0,40}$/.test(voice)) {
    throw new Error("Unknown narration voice.");
  }
  return (import.meta.env?.BASE_URL || "/") + "voices/" + voice + ".json";
}

async function loadVoice(voice) {
  if (loadedVoice !== voice || !voicePromise) {
    loadedVoice = voice;
    decodedClips.clear();
    voicePromise = fetch(voiceUrl(voice)).then(async (response) => {
      if (!response.ok)
        throw new Error("Your narration could not be loaded. Reconnect and try again.");
      const pack = await response.json();
      if (pack.mime !== "audio/mpeg" || !pack.clips)
        throw new Error("The narration file is incomplete.");
      return pack;
    });
  }
  try {
    return await voicePromise;
  } catch (error) {
    voicePromise = null;
    throw error;
  }
}

async function decodeScene(pack, voice, id) {
  const key = voice + ":" + id;
  if (decodedClips.has(key)) return decodedClips.get(key);
  if (!pack.clips[id]) throw new Error("A narration clip is missing.");
  const binary = atob(pack.clips[id]);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const samples = await decodeAudio(bytes.buffer);
  decodedClips.set(key, samples);
  return samples;
}

async function decodeAudio(bytes) {
  const OfflineContext = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!OfflineContext)
    throw new Error("Please use a current Safari, Chrome, or Firefox to play Drift.");
  if (!decoder) decoder = new OfflineContext(1, 1, SAMPLE_RATE);

  const buffer = await decoder.decodeAudioData(bytes);
  return new Float32Array(buffer.getChannelData(0));
}

async function loadBackground(settings) {
  if (settings.background === "off" || !settings.backgroundVolume) return null;
  const id = settings.background;
  if (!backgroundLoads.has(id)) {
    const loading = fetch(backgroundUrl(id)).then(async (response) => {
      if (!response.ok)
        throw new Error("Your background sound could not be loaded. Reconnect and try again.");
      return decodeAudio(await response.arrayBuffer());
    });
    backgroundLoads.set(id, loading);
  }
  try {
    return await backgroundLoads.get(id);
  } catch (error) {
    backgroundLoads.delete(id);
    throw error;
  }
}

export async function composeSession(plan, { isCancelled, onProgress }) {
  const [pack, background] = await Promise.all([
    loadVoice(plan.settings.voice),
    loadBackground(plan.settings),
  ]);
  const pieces = [wavHeader(plan.frames)];
  const silence = new Uint8Array(SAMPLE_RATE * 2);
  const silentSecond = new Blob([silence]);

  function appendGap(startFrame, frames) {
    if (!frames) return;
    if (background) {
      pieces.push(pcmForScene(null, { startFrame, frames }, plan, background));
      return;
    }
    while (frames >= SAMPLE_RATE) {
      pieces.push(silentSecond);
      frames -= SAMPLE_RATE;
    }
    if (frames > 0) pieces.push(silence.subarray(0, frames * 2));
  }

  let cursor = 0;
  for (const [index, item] of plan.items.entries()) {
    if (isCancelled()) return null;
    const samples = await decodeScene(pack, plan.settings.voice, item.id);
    if (isCancelled()) return null;
    appendGap(cursor, item.startFrame - cursor);
    pieces.push(pcmForScene(samples, item, plan, background));
    cursor = item.startFrame + item.frames;
    onProgress((index + 1) / plan.items.length);
    // Yield only while preparing, so Cancel stays responsive on phones.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  appendGap(cursor, plan.frames - cursor);

  // The native player owns the entire timeline, including the quiet gaps.
  // No JavaScript needs to wake up between scenes after the screen locks.
  return new Blob(pieces, { type: "audio/wav" });
}
