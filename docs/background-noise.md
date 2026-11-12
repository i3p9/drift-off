# Background sounds: evidence and implementation

Quiet pauses remain the default. Background sound is now an optional feature with **Off**, **Soft rain**, **Pink noise**, and **Brown noise**, a separate volume control, and a silent ending. It is a listening preference, not a claimed sleep treatment.

## What the evidence says

- [Riedy et al., 2021: Noise as a sleep aid, systematic review](https://pubmed.ncbi.nlm.nih.gov/33007706/) found very low-quality evidence supporting continuous noise for sleep. Results and exposure methods varied, so the review did not justify broadly promoting it as a sleep aid.
- [Ding et al., 2025: systematic review and meta-analysis of randomized trials](https://pubmed.ncbi.nlm.nih.gov/41151421/) examines white noise across different ages and clinical settings. The authors flag substantial variation between studies and limitations in methodological quality. Findings from those different settings do not establish an effect for this app.
- [Basner et al., 2026: pink noise and earplugs laboratory study](https://doi.org/10.1093/sleep/zsag001) studied 25 healthy adults over seven nights, with eight-hour sleep opportunities. Continuous pink noise at 50 dBA reduced REM sleep compared with a quiet control night. The study also tested environmental noise and earplugs. It does not directly test a quiet backing track during a short bedtime session.

None of these studies directly tests adding background sound to Drift's unrelated spoken scenes and pauses. Preference for a sound and evidence that it improves sleep are different questions. We should avoid a blanket claim that white, pink, brown, or nature noise improves sleep.

## Implemented controls

Sound starts off. Its volume control, initially 10%, stays visible and is dimmed and disabled while Off is selected. Choosing rain, pink noise, or brown noise enables the control without shifting the page. Settings apply when preparing the next session. The mix follows gradual softening when enabled, and the background always fades in gently and reaches silence over the last 15 seconds. Background audio has an additional 50% gain reduction across the slider range, without changing the narration gain at the same slider settings. Narration and background share one native track and one timeline. The earlier Low noise preference migrates to Pink noise while keeping its saved level.

These are product choices, rather than evidence-based treatment settings. A phone volume percentage is not a calibrated sound-pressure measurement. Sessions still end within 3–30 minutes; there is no all-night playback or claim that these sounds increase deep sleep.

## Apple's approach

Apple's [Background Sounds guide](https://support.apple.com/en-us/109346) offers a useful interaction reference: a small sound chooser with previews, a separate sound volume, and a timer. The [iPhone user guide](https://support.apple.com/en-lamr/guide/iphone/iphb2cfa052c/ios) also describes a separate volume while other media is playing and a control for stopping when the screen locks.

Drift keeps that small control set and ends the sound with the session. A full equalizer or a large sound library can wait. Apple's feature is not clinical evidence for adding it to this app.

To compare against Apple's sound, leave Drift's own background choice Off. On iPhone, open **Settings → Accessibility → Audio & Visual → Background Sounds**, choose a sound, enable **Use When Media Is Playing**, and lower **Volume with Media**. Leave **Stop Sounds When Locked** off for a locked-screen trial alongside Drift. This changes your phone's background sound, independently of Drift.

## Sources

| Source                            | Best use for Drift                       | Plan                                                                                                            |
| --------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Original generated noise          | A consistent, low-frequency noise option | Render the signal ourselves and mix it into the prepared session. No provider download or streaming is needed.  |
| CC0 field recordings on Freesound | Natural rain                             | Select a recording with a clear source page and CC0 designation, prepare a compact loop, and bundle it locally. |
| Apple Background Sounds           | Interaction and listening reference      | Use it to compare sound character and controls; choose our own source recordings for the app.                   |

Freesound contains several license types; use its [license guidance](https://freesound.org/help/faq/#licenses) and verify the individual recording's page. [CC0's terms](https://creativecommons.org/publicdomain/zero/1.0/) permit copying, editing, and redistribution under copyright. Keep the source URL, creator, license, and a checksum with any selected recording.

### Rain source and an alternative

The myLoop recording was selected and its public high-quality MP3 downloaded. The original full-size WAV was not downloaded. A 60-second excerpt is resampled, filtered, crossfaded into a 58-second loop, and normalized. The source, preparation, and checksums are kept in [`sound-sources/`](../sound-sources/README.md). The alternative recording remains a metadata shortlist item.

Pink noise and Brown noise use FFmpeg's [colored-noise generator](https://ffmpeg.org/ffmpeg-filters.html#anoisesrc) with a fixed seed for reproducible assets. Each has a 20 Hz high-pass to reduce sub-bass rumble, a two-second crossfade, DC removal, and normalization. Their 22-second loops are mono PCM at 22050 Hz. Automated frequency measurements check approximately −3 dB per octave for pink noise and −6 dB per octave for brown noise in the midrange. The prepared rain loop uses the same sample format.

Automated checks measure signal bounds, DC offset, and loop boundaries. These do not replace listening. Sound quality and relative levels still need a phone audition; no browser or speaker playback was performed during this work.

| Recording                                                                              | Listed source details                        | Why audition it                                                                                                                                           |
| -------------------------------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Rain in Munich Westpark — myLoop](https://freesound.org/people/myLoop/sounds/849800/) | CC0; about 88 seconds; 48 kHz stereo WAV     | The creator describes gentle rain and a seamless loop. Its source is about 32 MB.                                                                         |
| [Rain_Loop.wav — Snoopy20111](https://freesound.org/people/Snoopy20111/sounds/399072/) | CC0; 5 minutes 16 seconds; 96 kHz stereo WAV | A longer porch recording; the creator describes mono-compatible recording. The original is large, so keep a compact prepared version with its provenance. |

Before finalizing the sound on phones, listen for voices, traffic, thunder, sudden drips, background hum, and obvious repetition. Check the prepared loop after resampling and encoding, rather than trusting the source description. No third-party audio is streamed during a session.

## Playback implementation

The composer decodes the selected local loop once, then mixes it into the same prepared WAV as the narration. The loop position uses the absolute session frame, so it continues through narration and gaps. A second Web Audio player does not need to keep running while the phone is locked. Mix headroom prevents voice and background peaks from clipping together.

Continuous sound fills the currently silent parts of the WAV, so it increases memory and preparation work. A 30-minute mono PCM track is about 76 MiB before browser copies. The composer builds pieces instead of allocating an additional full-session floating-point mix. Test both short and 30-minute sessions on an actual iPhone and Android phone before sharing it widely.
