# Manual Cross-Device Checklist

Use this checklist before release on each target browser. Camera APIs require HTTPS
except for `localhost`, so mobile devices should use an HTTPS preview URL.

## Target Matrix

| Target          | Start camera                    | Switch camera                   | Take picture                    | Record video                    | Download/delete                 | Notes                                                                                  |
| --------------- | ------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------- |
| iPhone Safari   | Pending physical device run     | Pending physical device run     | Pending physical device run     | Pending physical device run     | Pending physical device run     | Confirm inline preview, permission recovery, and supported recording format.           |
| Android Chrome  | Pending physical device run     | Pending physical device run     | Pending physical device run     | Pending physical device run     | Pending physical device run     | Confirm rear/front camera switching and storage quota behavior.                        |
| Desktop Chrome  | Automated Chromium smoke passed | Automated Chromium smoke passed | Automated Chromium smoke passed | Manual recording check required | Automated Chromium smoke passed | Playwright uses fake camera/mic stream.                                                |
| Desktop Firefox | Pending manual run              | Pending manual run              | Pending manual run              | Pending manual run              | Pending manual run              | Confirm MediaRecorder MIME support.                                                    |
| Desktop Safari  | Pending manual run              | Pending manual run              | Pending manual run              | Pending manual run              | Pending manual run              | Confirm iCloud Private Relay/content blocker interactions do not affect local storage. |

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

## Validation Run

- 2026-05-18: `npm run lint`, `npm test`, and `npm run test:e2e` passed in the local
  workspace.
- 2026-05-18: Fixed a preview startup hardening issue by setting `autoplay`, `muted`,
  and `playsInline` in `camera.js` before calling `video.play()`. This protects mobile
  inline preview behavior if the HTML attributes are removed or altered.

Physical iPhone, Android, Firefox, and Safari runs still need to be executed on real
devices or hosted browser labs because this workspace only exposes automated Chromium.
