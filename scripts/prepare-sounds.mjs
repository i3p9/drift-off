import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { SAMPLE_RATE, wavHeader } from "../src/audio/session.js";

const root = new URL("../", import.meta.url);
const source = new URL("sound-sources/rain-in-munich-westpark.mp3", root);
const output = new URL("public/audio/", root);
const noiseSeed = 0x64726966;
await mkdir(output, { recursive: true });

function renderSamples(input, seconds) {
  const result = spawnSync(
    "ffmpeg",
    [
      "-nostdin",
      "-hide_banner",
      "-loglevel",
      "error",
      ...input,
      "-t",
      String(seconds),
      "-ar",
      String(SAMPLE_RATE),
      "-ac",
      "1",
      "-f",
      "f32le",
      "pipe:1",
    ],
    { maxBuffer: 16 * 1024 * 1024 },
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(result.stderr.toString() || "FFmpeg could not prepare the sound.");
  const samples = Float32Array.from({ length: result.stdout.length / 4 }, (_, i) =>
    result.stdout.readFloatLE(i * 4),
  );
  if (samples.length !== SAMPLE_RATE * seconds) throw new Error("The sound is incomplete.");
  return samples;
}

const rainSamples = renderSamples(
  ["-ss", "5", "-i", fileURLToPath(source), "-af", "highpass=f=70,lowpass=f=9000"],
  60,
);

function createNoise(color) {
  return renderSamples(
    [
      "-f",
      "lavfi",
      "-i",
      `anoisesrc=color=${color}:sample_rate=${SAMPLE_RATE}:seed=${noiseSeed}`,
      "-af",
      "highpass=f=20",
    ],
    24,
  );
}

function prepareLoop(samples) {
  const overlap = SAMPLE_RATE * 2;
  const loop = samples.slice(overlap);
  const join = loop.length - overlap;
  for (let i = 0; i < overlap; i++) {
    const angle = ((i / (overlap - 1)) * Math.PI) / 2;
    loop[join + i] = loop[join + i] * Math.cos(angle) + samples[i] * Math.sin(angle);
  }
  let sum = 0;
  for (const sample of loop) sum += sample;
  const mean = sum / loop.length;
  let peak = 0;
  let squares = 0;
  for (let i = 0; i < loop.length; i++) {
    loop[i] -= mean;
    peak = Math.max(peak, Math.abs(loop[i]));
    squares += loop[i] ** 2;
  }
  const gain = Math.min(0.8 / peak, 0.14 / Math.sqrt(squares / loop.length));
  for (let i = 0; i < loop.length; i++) loop[i] *= gain;
  return loop;
}

const sounds = [
  ["soft-rain.wav", prepareLoop(rainSamples)],
  ["pink-noise.wav", prepareLoop(createNoise("pink"))],
  ["brown-noise.wav", prepareLoop(createNoise("brown"))],
];
const outputs = [];
for (const [name, samples] of sounds) {
  const pcm = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    pcm.writeInt16LE(Math.round(samples[i] * (samples[i] < 0 ? 32768 : 32767)), i * 2);
  }
  const wav = Buffer.concat([wavHeader(samples.length), pcm]);
  await writeFile(new URL(name, output), wav);
  outputs.push({
    file: "public/audio/" + name,
    seconds: samples.length / SAMPLE_RATE,
    sha256: createHash("sha256").update(wav).digest("hex"),
  });
}
const original = await readFile(source);
await writeFile(
  new URL("sound-sources/manifest.json", root),
  JSON.stringify(
    {
      rain: {
        title: "Rain in Munich Westpark",
        creator: "myLoop",
        sourceUrl: "https://freesound.org/people/myLoop/sounds/849800/",
        downloadUrl: "https://cdn.freesound.org/previews/849/849800_18387771-hq.mp3",
        license: "CC0-1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
        sourceFile: "sound-sources/rain-in-munich-westpark.mp3",
        sourceFormat: "Public high-quality MP3 preview",
        sha256: createHash("sha256").update(original).digest("hex"),
        preparation:
          "First five seconds skipped; 60 seconds resampled to 22050 Hz mono, filtered, crossfaded, and normalized.",
      },
      noise: {
        source: "Generated locally with FFmpeg anoisesrc in scripts/prepare-sounds.mjs",
        documentationUrl: "https://ffmpeg.org/ffmpeg-filters.html#anoisesrc",
        colors: ["pink", "brown"],
        seed: "0x64726966",
        preparation:
          "22050 Hz mono, 20 Hz high-pass to reduce sub-bass rumble, two-second crossfade, DC removal, and normalization. No third-party recording.",
      },
      outputs,
    },
    null,
    2,
  ) + "\n",
);
console.log("Prepared a 58-second rain loop and 22-second pink- and brown-noise loops.");
