import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { DEFAULTS, normalizeSettings } from "../src/settings.js";
import { BACKGROUNDS } from "../src/data/backgrounds.js";
import { backgroundUrl, backgroundEnvelope } from "../src/audio/background.js";
import { pcmForScene, SAMPLE_RATE } from "../src/audio/session.js";

const root = fileURLToPath(new URL("../", import.meta.url));

test("old preferences keep their values and background sound starts off", () => {
  const settings = normalizeSettings({ minutes: 10, gap: 18, volume: 30 });
  assert.equal(settings.minutes, 10);
  assert.equal(settings.gap, 18);
  assert.equal(settings.volume, 30);
  assert.equal(settings.background, "off");
  assert.equal(settings.backgroundVolume, 10);
  assert.equal(normalizeSettings({ background: "rain", backgroundVolume: 0 }).backgroundVolume, 0);
  assert.equal(normalizeSettings({ backgroundVolume: 900 }).backgroundVolume, 100);
  assert.equal(normalizeSettings({ backgroundVolume: null }).backgroundVolume, 10);
  assert.equal(
    normalizeSettings({ background: "https://example.invalid/noise" }).background,
    "off",
  );
});

test("the old Low noise preference migrates to Pink noise without changing its level", () => {
  const settings = normalizeSettings({ background: "noise", backgroundVolume: 35 });
  assert.equal(settings.background, "pink");
  assert.equal(settings.backgroundVolume, 35);
  assert.equal(normalizeSettings({ background: "brown" }).background, "brown");
});

test("background choices resolve only to the three bundled sounds", () => {
  assert.equal(backgroundUrl("off"), null);
  assert.equal(backgroundUrl("rain"), "/audio/soft-rain.wav");
  assert.equal(backgroundUrl("pink"), "/audio/pink-noise.wav");
  assert.equal(backgroundUrl("brown"), "/audio/brown-noise.wav");
  for (const id of ["../rain", "https://example.invalid/noise", "", "rain?url=other"]) {
    assert.throws(() => backgroundUrl(id), /Unknown/);
  }
});

test("prepared loops are finite mono PCM, without clipping, DC drift, or an exceptional seam", () => {
  for (const sound of BACKGROUNDS.filter((sound) => sound.file)) {
    const wav = fs.readFileSync(root + "public/audio/" + sound.file);
    assert.equal(wav.toString("ascii", 0, 4), "RIFF");
    assert.equal(wav.toString("ascii", 8, 12), "WAVE");
    assert.equal(wav.readUInt16LE(22), 1);
    assert.equal(wav.readUInt32LE(24), SAMPLE_RATE);
    assert.equal(wav.readUInt16LE(34), 16);
    assert.equal(wav.readUInt32LE(40), wav.length - 44);
    const frames = (wav.length - 44) / 2;
    assert.ok(frames >= SAMPLE_RATE * 20);
    let sum = 0,
      squares = 0,
      stepSquares = 0,
      peak = 0;
    let previous = wav.readInt16LE(44) / 32768;
    const first = previous;
    for (let i = 0; i < frames; i++) {
      const sample = wav.readInt16LE(44 + i * 2) / 32768;
      sum += sample;
      squares += sample * sample;
      peak = Math.max(peak, Math.abs(sample));
      if (i) stepSquares += (sample - previous) ** 2;
      previous = sample;
    }
    assert.ok(peak <= 0.801 && peak > 0.2);
    assert.ok(Math.abs(sum / frames) < 0.0001);
    assert.ok(Math.sqrt(squares / frames) > 0.05);
    assert.ok(
      Math.abs(first - previous) < 4 * Math.sqrt(stepSquares / (frames - 1)),
      sound.id + " seam is too abrupt",
    );
  }
});

test("pink and brown noise have their expected frequency rolloff", () => {
  // Average windowed Goertzel measurements across the saved audio, independent of its generator.
  const size = 8192;
  const window = Float64Array.from(
    { length: size },
    (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)),
  );
  const frequencies = [200, 250, 315, 400];

  function power(wav, frequency) {
    const frames = (wav.length - 44) / 2;
    const bin = Math.round((frequency * size) / SAMPLE_RATE);
    const coefficient = 2 * Math.cos((2 * Math.PI * bin) / size);
    let total = 0;
    for (let section = 0; section < 12; section++) {
      const start = Math.floor(((frames - size) * section) / 11);
      let previous = 0;
      let beforePrevious = 0;
      for (let i = 0; i < size; i++) {
        const sample = (wav.readInt16LE(44 + (start + i) * 2) / 32768) * window[i];
        const current = sample + coefficient * previous - beforePrevious;
        beforePrevious = previous;
        previous = current;
      }
      total += previous ** 2 + beforePrevious ** 2 - coefficient * previous * beforePrevious;
    }
    return total;
  }

  for (const [color, expected] of [
    ["pink", -3],
    ["brown", -6],
  ]) {
    const wav = fs.readFileSync(root + "public/audio/" + color + "-noise.wav");
    const low = frequencies.reduce((sum, frequency) => sum + power(wav, frequency), 0);
    const high = frequencies.reduce((sum, frequency) => sum + power(wav, frequency * 4), 0);
    const dbPerOctave = (10 * Math.log10(high / low)) / 2;
    assert.ok(Math.abs(dbPerOctave - expected) < 1, color + ": " + dbPerOctave + " dB/octave");
  }
});

function plan(settings = {}) {
  return {
    sampleRate: 1000,
    frames: 180000,
    settings: {
      ...DEFAULTS,
      fade: false,
      volume: 100,
      background: "rain",
      backgroundVolume: 50,
      ...settings,
    },
  };
}

test("the background envelope starts and ends silently even when voice fading is disabled", () => {
  const current = plan();
  assert.equal(backgroundEnvelope(0, current.frames, current.sampleRate), 0);
  assert.equal(backgroundEnvelope(current.frames - 1, current.frames, current.sampleRate), 0);
  assert.equal(backgroundEnvelope(5000, current.frames, current.sampleRate), 1);
  assert.ok(backgroundEnvelope(current.frames - 5000, current.frames, current.sampleRate) < 0.5);
});

test("background phase and volume stay continuous across gap and clip boundaries", () => {
  const current = plan();
  const loop = Float32Array.from([0.1, -0.2, 0.3, -0.1, 0.2, -0.3, 0.15]);
  const render = (startFrame, frames) =>
    Buffer.from(pcmForScene(null, { startFrame, frames }, current, loop));
  assert.deepEqual(render(2000, 4000), Buffer.concat([render(2000, 1234), render(3234, 2766)]));
});

test("mix headroom avoids clipped speech and zero background volume matches Off", () => {
  const item = { startFrame: 3000, frames: 2000 };
  const voice = new Float32Array(item.frames).fill(0.99);
  const loop = new Float32Array(20).fill(0.8);
  const current = plan({ backgroundVolume: 100 });
  const mixed = new DataView(pcmForScene(voice, item, current, loop).buffer);
  assert.ok(mixed.getInt16(2000, true) > 22000 && mixed.getInt16(2000, true) < 23500);
  const muted = plan({ backgroundVolume: 0 });
  assert.deepEqual(pcmForScene(voice, item, muted, loop), pcmForScene(voice, item, muted));
  const off = plan({ background: "off" });
  assert.deepEqual(pcmForScene(voice, item, off, loop), pcmForScene(voice, item, off));
});

test("background sound is gentle at 10% while narration keeps its existing gain", () => {
  const current = plan({ backgroundVolume: 10 });
  const item = { startFrame: 3000, frames: 2000 };
  const loop = new Float32Array(20).fill(0.5);
  const voice = new Float32Array(item.frames).fill(0.5);
  const sample = (speech, background) =>
    new DataView(pcmForScene(speech, item, current, background).buffer).getInt16(2000, true);
  assert.equal(sample(null, loop), 745);
  assert.equal(sample(voice, new Float32Array(20)), 14894);
  assert.equal(sample(voice, loop), 15639);
});

test("background follows gradual softening and reaches a silent final sample", () => {
  const current = plan({ fade: true });
  const loop = new Float32Array(10).fill(0.5);
  const sample = (frame) =>
    new DataView(
      pcmForScene(null, { startFrame: frame, frames: 1 }, current, loop).buffer,
    ).getInt16(0, true);
  assert.ok(sample(10000) > sample(90000));
  assert.ok(sample(90000) > sample(current.frames - 1000));
  assert.equal(sample(0), 0);
  assert.equal(sample(current.frames - 1), 0);
});
