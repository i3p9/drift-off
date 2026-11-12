# Session handoff

Updated: 2026-11-12. Read this first when resuming, then use the [README](../README.md) for setup and the [phone checklist](mobile-checklist.md) for device testing.

## Current checkpoint

- App: **Drift**, a private bedtime scene player in `/Users/fahim/codes/projects/fastsleep-local`.
- Repository: `https://github.com/i3p9/drift-off`, branch `main`.
- Last confirmed pushed application checkpoint before this refinement: `e1d5c80` — `fix: update pref page`, recorded by the local remote-reference reflog as `update by push`. Assistant Git requests previously failed because this session could not resolve `github.com`. Check the current branch and deployment status when resuming; the live Cloudflare deployment has not been verified.
- The Vite migration, installable PWA, bundled narration, background sounds, branding, and Preferences controls are implemented. The 2026-11-12 refinement replaces the mobile bottom sheet with a full-screen route and fixes focus and background scroll handling. Remaining work is device verification and follow-up from the owner's feedback.

## What changed

**Preferences:** a full-height `/preferences` screen on phones, with browser Back/Forward, direct-link and reload handling, a fixed Back header, and a short forward transition. Desktop retains a compact panel with Done and no URL change on normal opening. Focus starts on the heading instead of an action button. The app's scroll area is locked while any dialog is open, preserving its position on return. Session and Voice groups contain the existing stepped sliders, voice selector, volume, and gradual-fade switch; changes save immediately. `src/preferences.js` owns navigation and focus. Cloudflare's SPA fallback and the existing offline navigation fallback support direct visits.

**Background sound:** Off, Soft rain, Pink noise, and Brown noise are on the main page below Begin winding down. The volume row stays in place and is disabled and dimmed when Off is selected. The previous Low noise setting migrates to Pink noise.

**Latest audio adjustment:** the owner found the background too loud at 20%. The new default is **10%**, with an additional **0.5 background gain multiplier** in `src/audio/session.js`. This applies to all three sounds without changing narration gain at the same slider settings. Existing saved percentages are preserved, so an existing installation may still show 20%. The quieter mix still needs the owner's listening check.

**Artwork:** the central planet and ring shapes stay fixed. Small moons travel along the same SVG paths used to draw the rings, which glow gently. Header, hero, favicon, and home-screen icons share the drawing. Motion respects Reduce Motion and pauses when the page is hidden or playback is paused.

## Next session

1. Confirm the latest application commit was pushed and its Cloudflare build succeeded. Close all Drift tabs and fully close the installed app before reopening; service-worker updates wait for existing app windows to close.
2. Test the refined Preferences screen on a small phone in portrait and landscape. Check background scroll locking, restored home scroll position, no action highlight on entry, Back/Forward, direct links, refresh, offline routing, saved choices, and screen-reader announcements. Desktop should retain its panel. Follow the [phone checklist](mobile-checklist.md).
3. Audition all three backgrounds at 10% with both voices. Check the balance during speech and pauses, the loop seams, and the silent ending. Gather the owner's feedback before further gain changes.
4. Complete real iPhone and Android checks for installation, offline playback with both voices and all backgrounds, screen locking, media controls, interruptions, and a 30-minute session. Desktop checks do not establish phone memory use or background-playback reliability.
5. Check the fixed planet/rings, orbiting moons, reduced motion, and updated app icons on the phone. Operating systems may cache an old home-screen icon until the app is added again.

No additional feature or redesign is queued beyond this verification. Use the owner's next feedback to choose subsequent work. Background-sound research and source decisions are in [background-noise.md](background-noise.md); no sleep-treatment benefit is claimed.

## Last verification

These checks passed locally for the 2026-11-12 preferences refinement:

- `npm test`: **42 tests**, covering the previous audio and privacy checks plus mobile/desktop navigation, Back/Forward, direct links, refresh, rapid Back taps, Escape, breakpoint changes, and focus. Navigation tests use Node test doubles; they do not establish physical scrolling or gesture behavior.
- `npm run build`: successful; **16 offline precache entries**, including both voice packs and all three sound loops.
- `npm run format:check` and `git diff --check`: passed.
- An earlier one-time terminal check exercised **336 preference combinations** through the UI sync/read functions, plus live control changes, zero volume, units, labels, IDs, and close targets. The control mappings are unchanged by this refinement. This probe is not part of the committed test suite.

Browser, speaker playback, screen-reader, and physical-phone testing were left to the owner. Do not describe those as verified.

## Where to make changes

| Area               | Files and details                                                                                                                                                                                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Settings UI        | `index.html`, `src/main.js`, `src/styles.css`. `syncTimeSlider` maps slider positions to the supported presets; `fillChoices` and `syncChoices` are shared by voice and background selectors.                                                                                                                       |
| Preferences        | `src/settings.js`. Defaults: 7 minutes, 14-second pauses, Serena, voice volume 65%, gradual fade on, background Off, background volume 10%. Storage key: `drift.preferences.v1`; seven preferences, no listening history.                                                                                           |
| Audio              | `src/audio/session.js` handles planning and PCM mixing; `compose.js` builds one in-memory WAV for the entire session. `player.js` and `media-session.js` handle native playback and OS controls. Keep pauses and background sound in that single track so playback does not depend on background JavaScript timers. |
| Sound assets       | `src/data/backgrounds.js`, `public/audio/`, `scripts/prepare-sounds.mjs`, and `sound-sources/`. Rain is a credited CC0 recording; pink and brown noise are generated locally. Prepared loops are committed; normal builds need no FFmpeg.                                                                           |
| Branding           | `src/assets/planet.svg` is the master. `src/brand.js` gives each copy unique IDs and handles motion preferences. After changing the SVG, run `npm run icons` and keep the generated files in `public/`.                                                                                                             |
| Narration          | `public/voices/serena.json` and `male-narrator.json` contain the playback audio. Serena uses the approved 1.25 tempo target; Daniel retains the approved recording. Original paid clips remain in `narration/` as a source archive.                                                                                 |
| PWA and deployment | `vite.config.js`, `src/install.js`, `public/_headers`, and `wrangler.toml`. Cloudflare **Workers Builds**, Worker name `drift-off`, build `npm run build`, deploy `npx wrangler deploy`, static directory `dist/`.                                                                                                  |

## Working preferences and constraints

- Keep the existing plain JavaScript/Vite architecture, readable names, small functions, and DRY/KISS approach. No UI framework is needed for the current scope.
- Code and terminal checks are authorized. Get explicit approval before browser previews, computer UI automation, screenshots, or speaker playback; the owner tests the mobile experience.
- The owner authorized committing and pushing the Settings update without another confirmation, and prefers short commit messages such as `fix: update pref page`.
- Keep narration and sound assets available offline from the app's own origin. Keep the original paid narration archive in Git. Source archives stay outside `dist/`; playback packs and loops must be deployed.
- No runtime voice-provider calls, analytics, accounts, or session history. Never add API keys or private environment files to Git. Existing narration does not need to be regenerated.

## Commands

Node.js 22.12+ is required; `.node-version` selects 22. Use `npm ci` if dependencies are missing.

```sh
cd /Users/fahim/codes/projects/fastsleep-local
npm test
npm run build
npm run format:check
git diff --check
```

`npm run dev` starts the local server when the owner wants to preview. Optional asset regeneration: `npm run icons` for branding; `npm run sounds` for sound loops, which requires local FFmpeg and the saved rain source. Ordinary builds use the committed assets.
