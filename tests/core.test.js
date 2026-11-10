import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as session from "../src/audio/session.js";
import * as settings from "../src/settings.js";
import { voiceUrl } from "../src/audio/compose.js";
import catalog from "../src/data/scenes.json" with { type: "json" };

const root = fileURLToPath(new URL("../", import.meta.url));
const core = { ...session, ...settings };

test("a seven-minute session has exact pauses and complete, non-repeating scenes", () => {
  const plan = core.createPlan(
    catalog.scenes,
    { minutes: 7, gap: 14, voice: catalog.voices[0].id },
    () => 0.47,
  );
  assert.equal(plan.frames / plan.sampleRate, 420);
  assert.ok(plan.items.length >= 20 && plan.items.length <= 30);
  assert.equal(new Set(plan.items.map((item) => item.id)).size, plan.items.length);
  assert.equal(plan.items[0].startFrame, Math.round(1.25 * plan.sampleRate));
  for (let index = 1; index < plan.items.length; index++) {
    const previous = plan.items[index - 1];
    assert.equal(
      plan.items[index].startFrame - previous.startFrame - previous.frames,
      14 * plan.sampleRate,
    );
  }
  for (const item of plan.items) assert.ok(item.startFrame + item.frames <= plan.frames);
});

test("all supported durations, voices, and pauses fit inside their stated session", () => {
  for (const minutes of core.MINUTES)
    for (const voice of core.VOICES)
      for (const gap of core.GAPS) {
        const plan = core.createPlan(catalog.scenes, { minutes, voice, gap });
        assert.equal(plan.frames, minutes * 60 * core.SAMPLE_RATE);
        assert.ok(plan.items.length > 0);
        assert.ok(plan.items.every((item) => item.startFrame + item.frames <= plan.frames));
      }
});

test("a replenished playlist never immediately repeats its previous scene", () => {
  const scenes = ["a", "b"].map((id) => ({
    id,
    text: id,
    durations: { [core.DEFAULTS.voice]: 1 },
  }));
  const plan = core.createPlan(scenes, { minutes: 3, gap: 8 }, () => 0);
  assert.ok(plan.items.length > 2);
  for (let index = 1; index < plan.items.length; index++)
    assert.notEqual(plan.items[index].id, plan.items[index - 1].id);
});

test("fade is continuous, bounded, and optional", () => {
  assert.equal(core.gainAt(0), 1);
  assert.equal(core.gainAt(1), 0.16);
  let previous = 1;
  for (let index = 0; index <= 100; index++) {
    const gain = core.gainAt(index / 100);
    assert.ok(gain <= previous && gain >= 0.16);
    assert.equal(core.gainAt(index / 100, false), 1);
    previous = gain;
  }
});

test("WAV header and PCM agree on sample rate, duration, channels, and byte count", () => {
  const frames = core.SAMPLE_RATE * 420;
  const header = core.wavHeader(frames);
  const view = new DataView(header.buffer);
  assert.equal(Buffer.from(header.subarray(0, 4)).toString(), "RIFF");
  assert.equal(Buffer.from(header.subarray(8, 12)).toString(), "WAVE");
  assert.equal(view.getUint32(4, true), frames * 2 + 36);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), core.SAMPLE_RATE);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), frames * 2);
  assert.throws(() => core.wavHeader(-1), RangeError);
  const samples = Float32Array.from({ length: 1000 }, () => 4);
  const item = { startFrame: 0, frames: 1000 };
  const pcm = core.pcmForScene(samples, item, {
    frames: 1000,
    sampleRate: core.SAMPLE_RATE,
    settings: { fade: false },
  });
  const pcmView = new DataView(pcm.buffer);
  assert.equal(pcm.length, 2000);
  assert.equal(pcmView.getInt16(0, true), 0);
  assert.equal(pcmView.getInt16(500 * 2, true), 32767);
  assert.equal(pcmView.getInt16(999 * 2, true), 0);
});

test("saved preferences cannot select remote voice paths or unsupported durations", () => {
  const result = core.normalizeSettings({
    voice: "https://example.invalid/voice",
    minutes: 999999,
    gap: -1,
    fade: "yes",
    volume: 999,
  });
  assert.equal(result.voice, core.DEFAULTS.voice);
  assert.equal(result.minutes, 7);
  assert.equal(result.gap, 14);
  assert.equal(result.fade, true);
  assert.equal(result.volume, 100);
  assert.equal(core.normalizeSettings({ volume: null }).volume, 65);
  assert.equal(core.formatTime(420), "7:00");
  assert.equal(core.formatTime(-1), "0:00");
});

test("the original scenes have matching local audio for each installed voice", () => {
  assert.equal(catalog.scenes.length, 180);
  assert.equal(new Set(catalog.scenes.map((scene) => scene.text)).size, 180);
  for (const voice of core.VOICES) {
    const pack = JSON.parse(
      fs.readFileSync(path.join(root, "public", "voices", `${voice}.json`), "utf8"),
    );
    const voicedScenes = catalog.scenes.filter((scene) => scene.durations[voice] > 0);
    assert.ok(voicedScenes.length > 0);
    assert.equal(Object.keys(pack.clips).length, voicedScenes.length);
    for (const scene of voicedScenes) {
      const clip = Buffer.from(pack.clips[scene.id], "base64");
      assert.ok(clip.length > 1000);
      if (pack.mime === "audio/mpeg")
        assert.ok(
          clip.subarray(0, 3).toString() === "ID3" ||
            (clip[0] === 0xff && (clip[1] & 0xe0) === 0xe0),
        );
      else assert.equal(clip.subarray(4, 8).toString(), "ftyp");
      assert.ok(scene.durations[voice] > 1 && scene.durations[voice] < 15);
    }
  }
});

test("catalog voice IDs cannot become external URLs or parent-directory paths", () => {
  for (const id of [
    "https://example.invalid/voice",
    "../voice",
    "voice?url=other",
    "",
    "../../.env.local",
  ]) {
    assert.throws(() => voiceUrl(id), /Unknown/);
  }
  assert.deepEqual(
    core.VOICES,
    catalog.voices.map((voice) => voice.id),
  );
});

test("runtime requests are restricted to this app and preferences contain no history", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const headers = fs.readFileSync(path.join(root, "public/_headers"), "utf8");
  const files = [
    "src/main.js",
    "src/settings.js",
    "src/install.js",
    "src/audio/compose.js",
    "src/audio/player.js",
    "src/audio/media-session.js",
  ];
  const scripts = files.map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
  assert.match(headers, /connect-src 'self'/);
  assert.match(headers, /worker-src 'self'/);
  assert.doesNotMatch(headers, /unsafe-inline|unsafe-eval|https?:/);
  assert.match(html, /name="referrer" content="no-referrer"/);
  assert.doesNotMatch(
    scripts,
    /https?:\/\/|XMLHttpRequest|WebSocket|EventSource|sendBeacon|speechSynthesis|\bDate\b/,
  );
  assert.equal((scripts.match(/localStorage\.setItem\(/g) || []).length, 1);
  assert.equal(voiceUrl(catalog.voices[0].id), "/voices/" + catalog.voices[0].id + ".json");
  assert.deepEqual(Object.keys(core.normalizeSettings({})).sort(), [
    "fade",
    "gap",
    "minutes",
    "voice",
    "volume",
  ]);
});

test("the prepared audio honors volume even when the phone ignores audio.volume", () => {
  const samples = Float32Array.from({ length: 1000 }, () => 0.5);
  const item = { startFrame: 0, frames: 1000 };
  const base = { frames: 1000, sampleRate: core.SAMPLE_RATE };
  const render = (volume) =>
    new DataView(
      core.pcmForScene(samples, item, { ...base, settings: { fade: false, volume } }).buffer,
    ).getInt16(1000, true);
  assert.equal(render(0), 0);
  assert.ok(Math.abs(render(50) * 2 - render(100)) <= 1);
});
