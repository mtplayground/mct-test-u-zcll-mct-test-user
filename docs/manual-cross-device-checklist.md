# Manual Cross-Device Checklist

Use this checklist before release on each target browser. Camera APIs require HTTPS
except for `localhost`, so mobile devices should use an HTTPS preview URL.

## Target Matrix

| Target          | Start camera                    | Switch camera                   | Take picture                    | Record video                    | Beauty preview                  | Download/delete                 | Notes                                                                                  |
| --------------- | ------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------- |
| iPhone Safari   | Pending physical device run     | Pending physical device run     | Pending physical device run     | Pending physical device run     | Pending physical device run     | Pending physical device run     | Confirm inline preview, permission recovery, and supported recording format.           |
| Android Chrome  | Pending physical device run     | Pending physical device run     | Pending physical device run     | Pending physical device run     | Pending physical device run     | Pending physical device run     | Confirm rear/front camera switching and storage quota behavior.                        |
| Desktop Chrome  | Automated Chromium smoke passed | Automated Chromium smoke passed | Automated Chromium smoke passed | Manual recording check required | Pending manual run              | Automated Chromium smoke passed | Playwright uses fake camera/mic stream.                                                |
| Desktop Firefox | Pending manual run              | Pending manual run              | Pending manual run              | Pending manual run              | Pending manual run              | Pending manual run              | Confirm MediaRecorder MIME support.                                                    |
| Desktop Safari  | Pending manual run              | Pending manual run              | Pending manual run              | Pending manual run              | Pending manual run              | Pending manual run              | Confirm iCloud Private Relay/content blocker interactions do not affect local storage. |

## Test Steps

1. Open the app over HTTPS, or `http://localhost:8080` for local desktop testing.
2. Confirm the first load shows the empty-gallery hint and disabled capture controls.
3. Select **Start** and grant camera/microphone permissions.
4. Confirm the preview stays inline, does not open fullscreen, and status changes to
   `Camera is ready.`
5. Select **Switch** twice and confirm the preview remains live.
6. Select **Take Picture** and confirm one gallery card appears with a still image.
7. Select **Record** and confirm controls are disabled while the countdown runs.
8. Confirm the video card appears and plays back with controls.
9. Use **Download** on both media types and confirm filenames begin with `snapvault-`.
10. Delete one item and confirm the gallery updates without a page reload.
11. Use **Clear All**, cancel once, then confirm once; verify the empty state returns.
12. Revoke camera permission in browser settings and confirm a friendly error banner.
13. Fill storage or simulate quota, then confirm the quota banner is shown.

## Beauty Filter Checks

Run these checks on iPhone Safari, Android Chrome, and at least one desktop browser:

1. Start the camera, move the **Beauty** slider from `0` to `50` to `100`, and confirm
   the live preview updates immediately at each level.
2. Move the slider back to `0` and confirm the preview returns to an unfiltered view.
3. Refresh the page after setting the slider to `50`; confirm the slider and preview
   restore the last-used level.
4. Record short videos at levels `0`, `50`, and `100`; confirm each saved video matches
   the preview appearance at the time of recording.
5. Take a picture at level `50`; confirm the gallery card shows a `Beauty 50` badge over
   the thumbnail.
6. Take a picture or record a video at level `0`; confirm no beauty badge appears on the
   resulting gallery card.
7. Download one filtered picture and one filtered video and confirm the downloaded media
   includes the same filter strength shown in the gallery.

## Storage Migration Check

Use a populated browser profile or seed `localStorage` manually before loading the app:

1. Before opening the updated app, create a v1 payload under `snapvault:v1:items` with at
   least one picture and one video.
2. Open the app and confirm the gallery still lists every v1 item.
3. Inspect `localStorage` and confirm `snapvault:v2:items` now exists with the same items
   plus `beautyLevel: 0` on each migrated record.
4. Confirm `snapvault:v1:items` is still present for the one-release safety window.
5. Add a new filtered capture and confirm it is written only to the v2 payload with its
   active `beautyLevel`.

## Validation Run

- 2026-05-18: `npm run lint`, `npm test`, and `npm run test:e2e` passed in the local
  workspace.
- 2026-05-18: Fixed a preview startup hardening issue by setting `autoplay`, `muted`,
  and `playsInline` in `camera.js` before calling `video.play()`. This protects mobile
  inline preview behavior if the HTML attributes are removed or altered.
- 2026-05-19: Added manual Beauty Filter coverage for preview updates, filtered
  recording parity, gallery badge behavior, and v1 to v2 localStorage migration.

Physical iPhone, Android, Firefox, and Safari runs still need to be executed on real
devices or hosted browser labs because this workspace only exposes automated Chromium.
