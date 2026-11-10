# Drift

A personal sleep-scene player with 180 original prompts and pre-generated Serena and Daniel narration. The app name is independent of the GitHub repository name.

## Develop locally

Use Node.js 22.12 or newer:

```sh
npm ci
npm run dev
```

Open the local URL Vite prints. The app uses plain JavaScript modules and CSS. There is no UI framework, backend, account system, or voice API at runtime. Development uses a local server; offline listening uses the installed production app.

Choose a session length, pauses, voice, and volume in Settings, then select **Begin winding down**. Sessions shuffle scenes without repeating until the collection has been used. They last 3–30 minutes, with 8–22-second pauses, an optional gradual fade, and a silent ending. Pause, resume, and dark-screen controls are included.

Each session is assembled in memory into one WAV track, including spoken scenes, pauses, volume, and fade. The native audio element plays that track, so moving to the next scene does not depend on background JavaScript timers. Audio Session and Media Session integrations provide playback focus and lock-screen controls where supported. Phone interruptions or closing the app can stop playback. Physical-device screen-lock behavior still needs the [mobile checks](docs/mobile-checklist.md).

## Install on a phone

Use **Install app** in the footer. Supported Android browsers show an installation prompt. On iPhone or iPad, open the hosted site in Safari, use **Share → Add to Home Screen**, and enable **Open as Web App** if shown. See [Apple's instructions](https://support.apple.com/en-ie/guide/iphone/iphea86e5236/ios).

The production app saves its shell and both voices for offline use, about 24 MB. Installation and offline saving require HTTPS, or localhost for development testing. Wait for the offline-ready message before disconnecting. Updates wait for the app to close so they do not interrupt a session. Start playback before locking the phone.

## Build and check

The development tools are Vite, Vite PWA, and Prettier. There are no application framework dependencies.

```sh
npm test
npm run build
npm run preview
```

Vite creates `dist/`; Vite PWA generates the manifest, offline service worker, and versioned cache. Original audio backups stay outside the deployment. `npm run format` formats source files, and `npm run format:check` checks formatting. Generated voice data and the original narration archive are excluded from formatting.

## Deploy from GitHub

The current project uses [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) with static assets. Keep these settings when connecting the GitHub repository:

| Setting           | Value                        |
| ----------------- | ---------------------------- |
| Production branch | `main`                       |
| Root directory    | Repository root; leave blank |
| Build command     | `npm run build`              |
| Deploy command    | `npx wrangler deploy`        |

The `.node-version` file selects Node.js 22. `wrangler.toml` serves `dist/` as static assets; its Worker name must match the dashboard project. No ElevenLabs key or app secrets are needed. The repository name can differ from the Drift app name.

## Privacy

The player uses its own scripts, styles, artwork, and narration. It makes no analytics, speech-provider, or session-reporting requests. The production Content Security Policy permits only same-origin connections, including audio downloads and offline caching. It blocks third-party assets and connections.

Only five preferences are saved in browser local storage: session duration, pause length, voice, fade, and volume. Drift saves no timestamps, session history, sleep measurements, or identifiers. **About → Reset saved preferences** clears those preferences.

The service worker caches app files and both voices; it stores no listening history. When hosted, Cloudflare receives ordinary page and asset requests. Restrict access separately if the hosted app should be private; keeping the GitHub repository private does not by itself restrict the hosted website.

## Bundled narration

- **Serena:** generated at 0.85 speed, then adjusted locally with pitch preserved to the approved 1.25 tempo target (`atempo=1.25/0.85`).
- **Daniel:** the approved recording at 0.85 speed, without a tempo adjustment.

Each voice has 180 ElevenLabs-generated clips. The complete playback audio is stored in `public/voices/` as JSON packs; keep those files in Git so Cloudflare can build the app without contacting a voice provider. The move from JavaScript packs to JSON preserves the audio bytes and timing metadata.

The original paid MP3 recordings are also kept in [`narration/`](narration/README.md), including the complete Serena and Daniel libraries and the earlier Katie and Lindsey Grace audition clips. Settings, prompts, checksums, and generation receipts are included so those recordings survive independently of the local archive. These backup files are excluded from the Cloudflare build. API credentials, temporary WAV files, one-time generation tools, and earlier macOS fallback voices remain outside the repository.

## Files

```text
index.html             Page markup
src/main.js            UI events and rendering
src/settings.js        Preference defaults, validation, and storage
src/install.js         Installation and offline-ready feedback
src/audio/             Session planning, composition, player, and OS controls
src/data/scenes.json   Prompt text, voices, and timing metadata
src/styles.css         Layout, artwork, motion, and phone styles
public/                Voice packs, icons, and hosting headers
narration/             Original paid recordings and metadata
tests/                 Timing, privacy, mobile volume, and playback checks
vite.config.js         Standard build and PWA configuration
wrangler.toml          Cloudflare static asset deployment
docs/                  Phone test checklist and background-noise research
```

## Background sound

Background noise is deferred to a second phase. Evidence varies by population, sound level, and exposure duration; it does not establish a benefit for Drift's brief scene-and-pause sessions. A future version could offer quiet, optional sound that fades with the session. See the [research notes](docs/background-noise.md).

## Verification

Automated checks cover session timing, silence gaps, complete clips, shuffle, fade, WAV encoding, volume, source privacy, native playback controls, cancellation, and autoplay recovery. The production build includes both voice packs in the offline precache. Browser and physical-phone testing remain manual for this migration, at the owner's request.
