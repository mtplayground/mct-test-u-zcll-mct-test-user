# Product Snapshot

## What It Is

ZeroClaw Camera Capture is a static, browser-only camera app built with plain HTML,
CSS, and ES modules. It runs without a backend and stores captured media locally in
the browser.

## What It Does

- Starts, stops, and switches the active camera using `getUserMedia`.
- Captures still pictures from the live video preview as JPEG data URLs.
- Records short videos with `MediaRecorder`, a 15-second countdown, supported MIME
  fallback, and a Stop button for ending recordings early.
- Stores captures in `localStorage` under a versioned schema.
- Renders a reactive gallery with picture/video cards, timestamps, download links,
  delete actions, and Clear All.
- Shows status banners for success, camera errors, and storage quota failures.

## Key User Constraints

- Camera access requires HTTPS in production; `localhost` is acceptable for local
  development.
- Browser storage is limited, roughly 5 MB per origin in many browsers.
- Captures are local to the current browser/device and are not uploaded anywhere.
- Browser support varies for camera switching and video recording formats.

## Architecture

- `index.html` is the app shell.
- `styles.css` contains responsive layout, accessibility polish, and theme variables.
- `js/app.js` wires UI controls and high-level workflows, including the Record/Stop
  recording button state.
- `js/camera.js` owns camera start/stop/switch behavior and capability detection.
- `js/capture.js` owns picture capture and video recording, including the
  `recordVideo(..., { onStart })` stop handle.
- `js/storage.js` owns schema validation, CRUD, quota rollback, and storage events.
- `js/gallery.js` renders gallery state from storage and reacts to storage changes.
- `js/ui.js` owns status banners and shared UI events.
- `js/errors.js` maps media-device errors to user-facing messages.
- `scripts/dev-server.js` is the lightweight static file server used for local and
  sprite-hosted runtime. It binds from `HOST`/`PORT`, serves files from the repository
  root, emits one controlled startup line, and otherwise keeps stdout quiet unless an
  actual startup error occurs.

## Testing and Verification

- Unit tests use Vitest with `happy-dom`; current coverage includes early-stop video
  recording, Record/Stop button state, and app-level early-stop save flow.
- E2E smoke testing uses Playwright Chromium with fake camera/microphone streams.
- `npm run verify:prod` serves the static app over local HTTPS with a temporary
  certificate and runs a production-style smoke flow.
- Manual device coverage is documented in `docs/manual-cross-device-checklist.md`.
- Accessibility notes and contrast checks are documented in `docs/accessibility-notes.md`.

## Conventions

- No build step is required; deploy the repository root as static files.
- Keep modules framework-free and browser-native.
- Use `storage:changed` for reactive gallery updates.
- Use `storage:quota-exceeded` and `camera:error`-style UI events for user-facing
  banners.
- Keep generated artifacts such as `node_modules`, Playwright reports, and test results
  out of git.
- Keep deployment artifacts and secrets such as `.env.production`, `.deploy_url`, and
  verification screenshots/scripts out of git.
