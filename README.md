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

Settings uses a bottom sheet on phones, with stepped sliders for duration and pauses, a Serena / Daniel selector, a volume slider, and a gradual-fade switch. Changes save as you make them. The Done button stays above the scrolling controls, including in landscape.

Background sound is on the main page, directly below **Begin winding down**. Use the **Off / Soft rain / Pink noise / Brown noise** buttons and the separate volume slider, initially 10%. The slider stays in place and is dimmed and disabled when sound is Off, so switching sounds does not shift the layout. Choose the sound and level before starting; the session is prepared with those settings. Background sound follows gradual softening when enabled and always fades to silence over the final 15 seconds. Background audio has an additional 50% gain reduction across the slider range. The mix reserves headroom to avoid clipping. Saved volume choices remain as set; the 10% default applies to new or reset preferences.

Each session is assembled in memory into one WAV track, including spoken scenes, pauses, volume, and fade. The native audio element plays that track, so moving to the next scene does not depend on background JavaScript timers. Audio Session and Media Session integrations provide playback focus and lock-screen controls where supported. Phone interruptions or closing the app can stop playback. Physical-device screen-lock behavior still needs the [mobile checks](docs/mobile-checklist.md).

## Install on a phone

Use **Install app** in the footer. Supported Android browsers show an installation prompt. On iPhone or iPad, open the hosted site in Safari, use **Share → Add to Home Screen**, and enable **Open as Web App** if shown. See [Apple's instructions](https://support.apple.com/en-ie/guide/iphone/iphea86e5236/ios).

The production app saves its shell, both voices, and all three background loops for offline use, about 29 MB. Installation and offline saving require HTTPS, or localhost for development testing. Wait for the offline-ready message before disconnecting. Updates wait for the app to close so they do not interrupt a session. Start playback before locking the phone.

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

Only seven preferences are saved in browser local storage: session duration, pause length, voice, fade, voice volume, background sound, and background volume. Drift saves no timestamps, session history, sleep measurements, or identifiers. **About → Reset saved preferences** clears those preferences. Older preferences without a background choice start with sound off; the previous Low noise choice becomes Pink noise and keeps its saved level.

The service worker caches app files, both voices, and all three background sounds; it stores no listening history. Nightly playback never contacts Freesound or ElevenLabs. When hosted, Cloudflare receives ordinary page and asset requests. Restrict access separately if the hosted app should be private; keeping the GitHub repository private does not by itself restrict the hosted website.

## Bundled narration

- **Serena:** generated at 0.85 speed, then adjusted locally with pitch preserved to the approved 1.25 tempo target (`atempo=1.25/0.85`).
- **Daniel:** the approved recording at 0.85 speed, without a tempo adjustment.

Each voice has 180 ElevenLabs-generated clips. The complete playback audio is stored in `public/voices/` as JSON packs; keep those files in Git so Cloudflare can build the app without contacting a voice provider. The move from JavaScript packs to JSON preserves the audio bytes and timing metadata.

The original paid MP3 recordings are also kept in [`narration/`](narration/README.md), including the complete Serena and Daniel libraries and the earlier Katie and Lindsey Grace audition clips. Settings, prompts, checksums, and generation receipts are included so those recordings survive independently of the local archive. These backup files are excluded from the Cloudflare build. API credentials, temporary WAV files, one-time generation tools, and earlier macOS fallback voices remain outside the repository.

## Files

```text
index.html             Page markup
src/main.js            UI events and rendering
src/brand.js           Shared planet artwork and reduced-motion feedback
src/assets/planet.svg  Master drawing for the header, hero, and icons
src/settings.js        Preference defaults, validation, and storage
src/install.js         Installation and offline-ready feedback
src/audio/             Session planning, composition, player, and OS controls
src/data/scenes.json   Prompt text, voices, and timing metadata
src/styles.css         Layout, artwork, motion, and phone styles
public/                Voice packs, icons, and hosting headers
narration/             Original paid recordings and metadata
sound-sources/         Saved rain source, license, and prepared-loop checksums
tests/                 Timing, privacy, mobile volume, and playback checks
vite.config.js         Standard build and PWA configuration
wrangler.toml          Cloudflare static asset deployment
docs/                  Phone test checklist and background-noise research
scripts/               Optional icon regeneration from the master SVG
```

## Background sound

Background sound is optional and off by default. Soft rain uses a CC0 recording by myLoop; Pink noise and Brown noise are generated locally with FFmpeg's colored-noise source. All three are bundled as PCM loops in `public/audio/`. Their source, processing, and checksums are documented in [`sound-sources/`](sound-sources/README.md). To regenerate them, install FFmpeg locally and run `npm run sounds`. Ordinary builds use the saved files and need no FFmpeg or network access to a sound provider.

Evidence varies by population, sound level, and exposure duration; it does not establish a benefit for Drift's brief scene-and-pause sessions. These are sound preferences, without a sleep-treatment claim. See the [research and design notes](docs/background-noise.md).

## Artwork and icons

The header and central illustration render the same `src/assets/planet.svg` drawing. The planet stays fixed at `(64, 64)`, and the rings stay fixed around it with a gentle glow. Only the small moons travel: each follows the same SVG path used to draw its ring. The larger illustration uses thinner rings. Motion pauses when the app is hidden or playback is paused, and the device's Reduce Motion setting disables it. About shows a note when that setting is active.

Controls have light press feedback, the sound chooser has a sliding selection highlight, and views and dialogs enter with a short fade. These transitions also respect Reduce Motion.

After editing the drawing, run `npm run icons` to regenerate the favicon and home-screen icons. The script uses Sharp only for SVG export. These generated files are committed, so ordinary builds still use `vite build` without an extra asset-generation step.

Production updates wait for existing app windows to close. After deploying a visual change, close all Drift tabs and fully close the installed app before reopening it. Existing home-screen icons may need the app to be added to the home screen again to refresh the operating system's cached icon.

## Verification

Automated checks cover session timing, quiet gaps when background sound is off, complete clips, shuffle, fade, WAV encoding, voice/background volume, mix headroom, loop continuity, pink/brown frequency rolloff, source privacy, native playback controls, cancellation, and autoplay recovery. The production build includes both voice packs and all three sound loops in the offline precache. Browser and physical-phone testing remain manual, at the owner's request.
