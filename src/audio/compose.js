import { VOICES } from "../settings.js";
import { SAMPLE_RATE, pcmForScene, wavHeader } from "./session.js";

let loadedVoice = null;
let voicePromise = null;
let decoder = null;
const decodedClips = new Map();

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
  const OfflineContext = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!OfflineContext)
    throw new Error("Please use a current Safari, Chrome, or Firefox to play Drift.");
  if (!decoder) decoder = new OfflineContext(1, 1, SAMPLE_RATE);

  const binary = atob(pack.clips[id]);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const buffer = await decoder.decodeAudioData(bytes.buffer);
  const samples = new Float32Array(buffer.getChannelData(0));
  decodedClips.set(key, samples);
  return samples;
}

export async function composeSession(plan, { isCancelled, onProgress }) {
  const pack = await loadVoice(plan.settings.voice);
  const pieces = [wavHeader(plan.frames)];
  const silence = new Uint8Array(SAMPLE_RATE * 2);
  const silentSecond = new Blob([silence]);

  function appendSilence(frames) {
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
    appendSilence(item.startFrame - cursor);
    pieces.push(pcmForScene(samples, item, plan));
    cursor = item.startFrame + item.frames;
    onProgress((index + 1) / plan.items.length);
    // Yield only while preparing, so Cancel stays responsive on phones.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  appendSilence(plan.frames - cursor);

  // The native player owns the entire timeline, including the quiet gaps.
  // No JavaScript needs to wake up between scenes after the screen locks.
  return new Blob(pieces, { type: "audio/wav" });
}
