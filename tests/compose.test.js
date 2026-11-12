import test from "node:test";
import assert from "node:assert/strict";
import { composeSession } from "../src/audio/compose.js";
import { SAMPLE_RATE } from "../src/audio/session.js";
import { DEFAULTS } from "../src/settings.js";
import { BACKGROUNDS } from "../src/data/backgrounds.js";

function prepareDecoder(t) {
  const requests = [];
  const previous = Object.getOwnPropertyDescriptor(globalThis, "OfflineAudioContext");
  class FakeDecoder {
    async decodeAudioData() {
      return { getChannelData: () => new Float32Array(SAMPLE_RATE).fill(0.25) };
    }
  }
  Object.defineProperty(globalThis, "OfflineAudioContext", {
    configurable: true,
    value: FakeDecoder,
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "OfflineAudioContext", previous);
    else delete globalThis.OfflineAudioContext;
  });
  const encoded = Buffer.from("test decoder input").toString("base64");
  t.mock.method(globalThis, "fetch", async (url) => {
    requests.push(url);
    if (url.startsWith("/audio/")) {
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) };
    }
    return {
      ok: true,
      json: async () => ({
        mime: "audio/mpeg",
        clips: { "scene-001": encoded, "scene-002": encoded },
      }),
    };
  });
  return requests;
}

function shortPlan() {
  return {
    settings: { ...DEFAULTS, fade: false, volume: 50 },
    sampleRate: SAMPLE_RATE,
    frames: SAMPLE_RATE * 5,
    items: [
      { id: "scene-001", startFrame: 0, frames: SAMPLE_RATE },
      { id: "scene-002", startFrame: SAMPLE_RATE * 3, frames: SAMPLE_RATE },
    ],
  };
}

test("the composed native track contains complete clips, exact gaps, volume, and a silent ending", async (t) => {
  prepareDecoder(t);
  const progress = [];
  const blob = await composeSession(shortPlan(), {
    isCancelled: () => false,
    onProgress: (value) => progress.push(value),
  });
  const data = new DataView(await blob.arrayBuffer());
  const sample = (frame) => data.getInt16(44 + frame * 2, true);
  assert.equal(blob.type, "audio/wav");
  assert.equal(blob.size, 44 + SAMPLE_RATE * 5 * 2);
  assert.equal(data.getUint32(40, true), SAMPLE_RATE * 5 * 2);
  assert.equal(sample(SAMPLE_RATE / 2), 4096);
  assert.equal(sample(SAMPLE_RATE * 3.5), 4096);
  for (let frame = SAMPLE_RATE; frame < SAMPLE_RATE * 3; frame++) assert.equal(sample(frame), 0);
  for (let frame = SAMPLE_RATE * 4; frame < SAMPLE_RATE * 5; frame++)
    assert.equal(sample(frame), 0);
  assert.deepEqual(progress, [0.5, 1]);
});

test("cancelling between decoded clips discards the unfinished track", async (t) => {
  prepareDecoder(t);
  let cancelled = false;
  const blob = await composeSession(shortPlan(), {
    isCancelled: () => cancelled,
    onProgress() {
      cancelled = true;
    },
  });
  assert.equal(blob, null);
});

for (const sound of BACKGROUNDS.filter((sound) => sound.file)) {
  test(sound.name + " shares the native WAV and timeline with narration", async (t) => {
    const requests = prepareDecoder(t);
    const plan = shortPlan();
    plan.settings.background = sound.id;
    const blob = await composeSession(plan, { isCancelled: () => false, onProgress() {} });
    const data = new DataView(await blob.arrayBuffer());
    const sample = (frame) => data.getInt16(44 + frame * 2, true);
    assert.ok(requests.includes("/audio/" + sound.file));
    assert.equal(blob.size, 44 + SAMPLE_RATE * 5 * 2);
    assert.equal(sample(SAMPLE_RATE * 2), 372);
    assert.equal(sample(SAMPLE_RATE * 3.5), 4096);
    assert.equal(sample(0), 0);
    assert.equal(sample(SAMPLE_RATE * 5 - 1), 0);
  });
}

test("a failed background load can be retried after reconnecting", async (t) => {
  // Use an empty cache so earlier successful loads cannot hide the failed request.
  const { composeSession } = await import("../src/audio/compose.js?retry-test");
  prepareDecoder(t);
  const fetchSound = globalThis.fetch;
  let fail = true;
  t.mock.method(globalThis, "fetch", async (url) => {
    if (url === "/audio/brown-noise.wav" && fail) return { ok: false };
    return fetchSound(url);
  });
  const plan = shortPlan();
  plan.settings.background = "brown";
  const options = { isCancelled: () => false, onProgress() {} };
  await assert.rejects(() => composeSession(plan, options), /background sound could not be loaded/);
  fail = false;
  const blob = await composeSession(plan, options);
  assert.equal(blob.size, 44 + SAMPLE_RATE * 5 * 2);
});
