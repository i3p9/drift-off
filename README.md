# Drift

A personal sleep-scene player with 180 original prompts and pre-generated Serena and Daniel narration. The app name is independent of the GitHub repository name.

## Open locally

Open `index.html` in Chrome or Safari. Keep the files together, including `voices/`. Playback requires no server, installation, API key, subscription, or internet connection.

Choose a session length, pauses, voice, and volume in Settings, then select **Begin winding down**. Sessions shuffle scenes without repeating until the collection has been used. They last 3–30 minutes, with 8–22-second pauses, an optional gradual fade, and a silent ending. Pause, resume, and dark-screen controls are included.

Each session is assembled in memory into one WAV track, including the spoken scenes and silent pauses. Closing the tab or suspending the browser can interrupt playback; mobile screen-lock behavior has not been verified.

## Build and check

Use Node.js 22 or newer. There are no package dependencies to install.

```sh
npm test
npm run build
```

The build recreates `dist/` using only the player assets, selected voice packs, and `_headers`. It does not generate narration or a ZIP. Build output is ignored by Git.

## Deploy from GitHub

Push this repository to GitHub and connect it to a Cloudflare Pages project. Use these settings with [Cloudflare's Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/):

| Setting | Value |
| --- | --- |
| Framework preset | None |
| Production branch | `main` |
| Root directory | Repository root; leave blank |
| Build command | `npm run build` |
| Build output directory | `dist` |

The `.node-version` file selects Node.js 22. No API keys or build secrets are needed. The GitHub repository name can differ from the Drift app name.

## Privacy

The player uses bundled scripts, styles, artwork, and narration. It makes no analytics, speech-provider, or session-reporting requests. Content Security Policy blocks network connection APIs and third-party assets.

Only five preferences are saved in browser local storage: session duration, pause length, voice, fade, and volume. Drift saves no timestamps, session history, sleep measurements, or identifiers. **About → Reset saved preferences** clears those preferences.

Direct-file playback works offline. When hosted, Cloudflare receives ordinary page and asset requests. Restrict access separately if the hosted app should be private; keeping the GitHub repository private does not by itself restrict the hosted website.

## Bundled narration

- **Serena:** generated at 0.85 speed, then adjusted locally with pitch preserved to the approved 1.25 tempo target (`atempo=1.25/0.85`).
- **Daniel:** the approved recording at 0.85 speed, without a tempo adjustment.

Each voice has 180 ElevenLabs-generated clips. The complete playback audio is stored in `voices/`; keep those files in Git so Cloudflare can build the app without contacting a voice provider.

The original paid MP3 recordings are also kept in [`narration/`](narration/README.md), including the complete Serena and Daniel libraries and the earlier Katie and Lindsey Grace audition clips. Settings, prompts, checksums, and generation receipts are included so those recordings survive independently of the local archive. These backup files are excluded from the Cloudflare build. API credentials, temporary WAV files, one-time generation tools, and earlier macOS fallback voices remain outside the repository.

## Files

- `index.html`, `styles.css`, `app.js`, `engine.js`, `icon.svg`: player UI, artwork, and audio assembly.
- `scenes.js`, `voices/`: prompt text, timing metadata, and bundled narration.
- `narration/`: original paid MP3 recordings and metadata for backup.
- `_headers`, `wrangler.toml`: Cloudflare static hosting configuration.
- `tools/build.mjs`: dependency-free static build.
- `tests/core.test.cjs`: session timing, pauses, shuffle, fade, WAV data, voice completeness, and runtime privacy checks.
