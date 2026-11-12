# Phone checks before sharing Drift

This migration was checked in code and the terminal. Browser testing was left to the owner. Complete these checks on an actual iPhone and Android phone; a resized desktop window cannot verify background playback.

## Install and save offline

1. Deploy the latest commit to the HTTPS site and open it on your phone.
2. Open **Install app**. Wait for **Saved for offline use. Both voices and background sounds are ready.**
3. On iPhone/iPad, use Safari's **Share → Add to Home Screen**, enable **Open as Web App** if offered, and tap **Add**. On Android, accept **Install app** or use the browser menu.
4. Launch Drift from the home-screen icon. Check that it opens without the normal browser address bar and respects the camera cutout and home indicator. Open **About** and wait for its offline-ready message too; an installed app can use different storage from the browser.
5. Turn on airplane mode. Close and reopen Drift, then start a session with each voice and each background sound. Both voices, rain, pink noise, and brown noise should work offline.

## Locked screen and interruptions

1. Choose a three-minute session. Start it and wait until narration is playing.
2. Lock the phone for at least one minute. Confirm several scenes play with their quiet pauses.
3. Pause and resume from the lock screen or headset. Confirm it resumes in place.
4. Unlock and check the remaining time agrees with what played. The session should finish silently after three minutes.
5. Repeat from the installed app and the ordinary browser, with each voice. Try a longer session once the short tests pass.
6. Test an interruption, such as another app taking audio focus. Drift should pause; resume deliberately from its controls. Note any phone/OS/browser combination where this behaves differently.

## Background sound

1. Find the Off / Soft rain / Pink noise / Brown noise buttons directly below **Begin winding down**. After resetting preferences, Off should be selected and the sound-volume row visible, dimmed, and disabled.
2. Switch between all four choices. The selection highlight should slide, the volume row should enable for a sound, and the rest of the page should stay in place. Check all four labels fit on a small phone and confirm the saved level is kept. After resetting preferences, confirm the level starts at 10%. Test 0%, 10%, 20%, and a higher level at a comfortable device volume. An existing Low noise preference should now select Pink noise.
3. Start a session with each sound. Listen across several narration boundaries: the background should continue through pauses without restarting, clicking, or abruptly changing level.
4. Check that speech remains understandable. Repeat with voice fading enabled; both should soften. With voice fading disabled, the background should still fade to silence at the end.
5. Lock the phone during a session with background sound. Narration and background should pause and resume together from the lock screen.
6. Try a 30-minute session once the short tests pass. Preparation and memory use need checking on real phones; desktop measurements do not establish mobile performance.

Media Session supplies OS controls, and the track contains its own pauses; neither gives a web app unrestricted background execution. Phone behavior must be tested before promising it to friends. Force-closing the app stops playback.

## Layout and accessibility

- Check portrait and landscape, including a small screen. Settings should scroll without hiding the Done button.
- Test Settings, Install, About, pause/resume, Cancel during preparation, and Darken screen.
- Check low, medium, and zero app volume. The app volume is part of the prepared audio, including on iPhones.
- Confirm the central planet and both rings stay still. The rings should glow gently, and each small moon should travel along its ring. Check the smaller header mark and the favicon/home-screen icon use the same planet design.
- Check light press feedback and the short view and dialog transitions. Use a keyboard to change the sound choice with arrow keys and confirm its focus outline stays visible.
- Enable Reduce Motion in the phone's accessibility settings. The moons, glow, and stars should stop animating, controls should change without transitions, and About should explain why. Turning Reduce Motion off should restore animation without reloading.
- Confirm no prompts request microphone, notification, camera, or location access.

## Updates

Keep a session playing while deploying an update. It should continue without an automatic page reload. Close Drift after the session, then reopen it to pick up the update and check offline readiness again.
