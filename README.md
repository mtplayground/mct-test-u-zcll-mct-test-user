# ZeroClaw Camera Capture

ZeroClaw is a static browser camera app built with plain HTML, CSS, and ES modules. It
is designed to run entirely in the browser, with captured media stored locally on the
device.

## Project Layout

- `index.html` contains the application shell.
- `styles.css` contains global responsive styles.
- `js/app.js` is the module entry point loaded by the page.
- `js/camera.js`, `js/capture.js`, `js/storage.js`, `js/gallery.js`, `js/ui.js`, and
  `js/errors.js` contain the feature modules as they are implemented.
- `scripts/dev-server.js` serves the static app for local development.
- `tests/` contains Vitest smoke and unit tests.

## Requirements

- Node.js 20 or newer.
- A browser with ES module support, `navigator.mediaDevices.getUserMedia`, Canvas,
  `MediaRecorder`, and `localStorage`.
- A camera and microphone permission prompt that can be accepted by the user.

Modern Chromium, Firefox, and Safari releases support the core APIs used by this app.
Browser behavior can still vary by device, especially for camera switching,
`MediaRecorder` codecs, and iOS camera permission handling.

## Local Development

Install dependencies:

```bash
npm install
```

Start the local server:

```bash
npm run dev
```

By default the server binds to `0.0.0.0:8080` for container compatibility and prints a
browser URL at:

```text
http://localhost:8080/
```

Use the `localhost` URL when testing camera features. Browsers treat `localhost` as a
secure context exception, so `getUserMedia` can work during development without a TLS
certificate.

Optional settings can be copied from `.env.example` into a local `.env` file:

```env
PORT=8080
HOST=0.0.0.0
```

Run validation:

```bash
npm run lint
npm test
npm run test:e2e
npm run format
```

Run the production HTTPS smoke check:

```bash
npm run verify:prod
```

For manual device coverage, use `docs/manual-cross-device-checklist.md`. For the
accessibility pass, see `docs/accessibility-notes.md`.

## HTTPS Requirement

Camera APIs require a secure context. In production, serve the app over HTTPS. Plain
`http://` origins should be expected to fail camera access except for browser-defined
local development exceptions such as `http://localhost`.

For cross-device testing on a phone or tablet, use an HTTPS preview URL from a hosting
provider or put a trusted TLS proxy in front of the local server.

## Storage Caveat

Captured items are stored in browser storage. Most browsers provide roughly 5 MB of
`localStorage` per origin, though exact limits and eviction behavior vary. Photos and
especially videos can fill that space quickly. Users should download captures they want
to keep and clear old local items when storage fills up.

## Deployment

This app is static. There is no bundling step: deploy the repository root as the
published directory and ensure the final URL uses HTTPS. Before deploying, run:

```bash
npm ci
npm run lint
npm test
npm run test:e2e
npm run verify:prod
```

### GitHub Pages

```bash
git push origin main
gh api \
  --method POST \
  /repos/<owner>/<repo>/pages \
  -f source.branch=main \
  -f source.path=/
```

If Pages already exists, update it instead:

```bash
gh api \
  --method PUT \
  /repos/<owner>/<repo>/pages \
  -f source.branch=main \
  -f source.path=/
```

Use the generated `https://<owner>.github.io/<repo>/` URL.

### Cloudflare Pages

```bash
npx wrangler pages deploy . \
  --project-name zeroclaw-camera-capture \
  --branch main
```

In the Cloudflare dashboard, keep the build command empty and the output directory as
the repository root.

### Netlify

```bash
npx netlify deploy --prod --dir .
```

For linked Git repositories, leave the build command empty and set the publish directory
to `.`.

### Vercel

```bash
npx vercel --prod
```

Use the `Other` framework preset, leave the build command empty, and set the output
directory to `.`.

### Self-Hosted nginx

Copy the repository files to a web root and serve them over TLS:

```bash
rsync -av \
  --exclude .git \
  --exclude node_modules \
  --exclude test-results \
  --exclude playwright-report \
  ./ deploy@camera.example.com:/var/www/zeroclaw/
```

```nginx
server {
  listen 443 ssl http2;
  server_name camera.example.com;

  ssl_certificate /etc/letsencrypt/live/camera.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/camera.example.com/privkey.pem;

  root /var/www/zeroclaw;
  index index.html;

  location / {
    try_files $uri $uri/ =404;
  }
}
```

Enable the site and reload nginx:

```bash
sudo ln -s /etc/nginx/sites-available/zeroclaw /etc/nginx/sites-enabled/zeroclaw
sudo nginx -t
sudo systemctl reload nginx
```

Redirect port 80 to HTTPS if the host accepts plain HTTP traffic.

### Self-Hosted Caddy

Copy the files:

```bash
rsync -av \
  --exclude .git \
  --exclude node_modules \
  --exclude test-results \
  --exclude playwright-report \
  ./ deploy@camera.example.com:/var/www/zeroclaw/
```

Use this Caddyfile:

```caddyfile
camera.example.com {
  root * /var/www/zeroclaw
  file_server
  encode zstd gzip
}
```

Reload Caddy:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```
