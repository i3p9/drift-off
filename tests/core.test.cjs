const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const core = require("../engine.js");
const root = path.resolve(__dirname, "..");
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, "scenes.js"), "utf8"), context);
const catalog = JSON.parse(JSON.stringify(context.DRIFT_CATALOG));
core.configureVoices(catalog.voices);

test("a seven-minute session has exact pauses and complete, non-repeating scenes", () => {
  const plan = core.createPlan(catalog.scenes, { minutes: 7, gap: 14, voice: catalog.voices[0].id }, () => 0.47);
  assert.equal(plan.frames / plan.sampleRate, 420);
  assert.ok(plan.items.length >= 20 && plan.items.length <= 30);
  assert.equal(new Set(plan.items.map(item => item.id)).size, plan.items.length);
  assert.equal(plan.items[0].startFrame, Math.round(1.25 * plan.sampleRate));
  for (let index = 1; index < plan.items.length; index++) {
    const previous = plan.items[index - 1];
    assert.equal(plan.items[index].startFrame - previous.startFrame - previous.frames, 14 * plan.sampleRate);
  }
  for (const item of plan.items) assert.ok(item.startFrame + item.frames <= plan.frames);
});

test("all supported durations, voices, and pauses fit inside their stated session", () => {
  for (const minutes of core.MINUTES) for (const voice of core.VOICES) for (const gap of core.GAPS) {
    const plan = core.createPlan(catalog.scenes, { minutes, voice, gap });
    assert.equal(plan.frames, minutes * 60 * core.SAMPLE_RATE);
    assert.ok(plan.items.length > 0);
    assert.ok(plan.items.every(item => item.startFrame + item.frames <= plan.frames));
  }
});

test("a replenished playlist never immediately repeats its previous scene", () => {
  const scenes = ["a", "b"].map(id => ({ id, text: id, durations: { [core.DEFAULTS.voice]: 1 } }));
  const plan = core.createPlan(scenes, { minutes: 3, gap: 8 }, () => 0);
  assert.ok(plan.items.length > 2);
  for (let index = 1; index < plan.items.length; index++) assert.notEqual(plan.items[index].id, plan.items[index - 1].id);
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
  const pcm = core.pcmForScene(samples, item, { frames: 1000, sampleRate: core.SAMPLE_RATE, settings: { fade: false } });
  const pcmView = new DataView(pcm.buffer);
  assert.equal(pcm.length, 2000);
  assert.equal(pcmView.getInt16(0, true), 0);
  assert.equal(pcmView.getInt16(500 * 2, true), 32767);
  assert.equal(pcmView.getInt16(999 * 2, true), 0);
});

test("saved preferences cannot select remote voice paths or unsupported durations", () => {
  const result = core.normalizeSettings({ voice: "https://example.invalid/voice", minutes: 999999, gap: -1, fade: "yes", volume: 999 });
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
  assert.equal(new Set(catalog.scenes.map(scene => scene.text)).size, 180);
  for (const voice of core.VOICES) {
    const sandbox = vm.createContext({});
    vm.runInContext(fs.readFileSync(path.join(root, "voices", `${voice}.js`), "utf8"), sandbox);
    const pack = sandbox.DRIFT_VOICE_PACKS[voice];
    const voicedScenes = catalog.scenes.filter(scene => scene.durations[voice] > 0);
    assert.ok(voicedScenes.length > 0);
    assert.equal(Object.keys(pack.clips).length, voicedScenes.length);
    for (const scene of voicedScenes) {
      const clip = Buffer.from(pack.clips[scene.id], "base64");
      assert.ok(clip.length > 1000);
      if (pack.mime === "audio/mpeg") assert.ok(clip.subarray(0, 3).toString() === "ID3" || (clip[0] === 0xff && (clip[1] & 0xe0) === 0xe0));
      else assert.equal(clip.subarray(4, 8).toString(), "ftyp");
      assert.ok(scene.durations[voice] > 1 && scene.durations[voice] < 15);
    }
  }
});

test("catalog voice IDs cannot become external URLs or parent-directory paths", () => {
  for (const id of ["https://example.invalid/voice", "../voice", "voice?url=other", "", "../../.env.local"]) {
    assert.throws(() => core.configureVoices([{ id }]), /invalid/);
  }
  assert.deepEqual(core.VOICES, catalog.voices.map(voice => voice.id));
});

test("the app blocks network APIs and references only its bundled runtime files", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /name="referrer" content="no-referrer"/);
  assert.doesNotMatch(app, /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|speechSynthesis|serviceWorker/);
  assert.doesNotMatch(`${html}\n${css}`, /(?:src|href)=["']https?:|url\(\s*["']?https?:|@import/);
  assert.doesNotMatch(app, /\bDate\b|console\.|fastsleep\.app/);
  assert.equal((app.match(/localStorage\.setItem\(/g) || []).length, 1);
  for (const match of html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)) {
    assert.ok(fs.existsSync(path.join(root, match[1])), `Missing runtime asset: ${match[1]}`);
  }
});
