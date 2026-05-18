# ZeroClaw Camera Capture

ZeroClaw is a static browser app for camera capture workflows. This repository starts with a plain HTML, CSS, and JavaScript module layout so each feature can be added in small, testable issues.

## Project Layout

- `index.html` contains the application shell.
- `styles.css` contains global responsive styles.
- `js/app.js` is the module entry point loaded by the page.
- `js/camera.js`, `js/capture.js`, `js/storage.js`, `js/gallery.js`, `js/ui.js`, and `js/errors.js` are reserved for feature modules.

## Running Locally

Open `index.html` directly in a browser for the initial static layout.

Later camera features will require a secure context. Use `localhost` during development or serve the app over HTTPS when testing on another device.
