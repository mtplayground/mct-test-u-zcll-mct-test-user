import { createServer } from "node:https";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

const tempDir = mkdtempSync(join(tmpdir(), "zeroclaw-prod-"));
const keyPath = join(tempDir, "localhost.key");
const certPath = join(tempDir, "localhost.crt");

try {
  createCertificate();
  const server = await startHttpsServer();
  const address = server.address();
  const baseURL = `https://127.0.0.1:${address.port}`;

  try {
    await runSmokeCheck(baseURL);
    console.log(`Production HTTPS smoke passed at ${baseURL}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
} finally {
  rmSync(tempDir, { force: true, recursive: true });
}

function createCertificate() {
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      keyPath,
      "-out",
      certPath,
      "-subj",
      "/CN=localhost",
      "-days",
      "1",
      "-addext",
      "subjectAltName=DNS:localhost,IP:127.0.0.1",
    ],
    {
      stdio: "ignore",
    },
  );
}

function startHttpsServer() {
  const server = createServer(
    {
      cert: readFileSync(certPath),
      key: readFileSync(keyPath),
    },
    async (request, response) => {
      try {
        if (!["GET", "HEAD"].includes(request.method || "")) {
          sendText(response, 405, "Method Not Allowed");
          return;
        }

        const requestUrl = new URL(request.url || "/", "https://127.0.0.1");
        const filePath = await resolveRequestPath(requestUrl.pathname);
        const body = request.method === "HEAD" ? null : await readFile(filePath);

        response.writeHead(200, {
          "Cache-Control": "no-store",
          "Content-Type":
            contentTypes.get(extname(filePath)) || "application/octet-stream",
        });
        response.end(body);
      } catch (error) {
        const statusCode = error?.code === "ENOENT" ? 404 : 500;
        sendText(
          response,
          statusCode,
          statusCode === 404 ? "Not Found" : "Internal Server Error",
        );
      }
    },
  );

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(server);
    });
  });
}

async function runSmokeCheck(baseURL) {
  const browser = await chromium.launch({
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  });

  try {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      permissions: ["camera", "microphone"],
    });
    const page = await context.newPage();

    await page.goto(baseURL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole("button", { name: "Start" }).click();
    await page.getByText("Camera is ready.").waitFor();
    await page.waitForFunction(() => {
      const video = document.querySelector("#camera-preview");
      return video && video.videoWidth > 0 && video.videoHeight > 0;
    });
    await page.getByRole("button", { name: "Take Picture" }).click();
    await page.locator(".gallery-card").waitFor();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByText("No captures yet.").waitFor();
  } finally {
    await browser.close();
  }
}

async function resolveRequestPath(pathname) {
  const decodedPath = decodeURIComponent(pathname);
  const requestedPath = resolve(rootDir, `.${decodedPath}`);
  const relation = relative(rootDir, requestedPath);

  if (relation.startsWith("..") || isAbsolute(relation)) {
    const error = new Error("Path is outside the project root.");
    error.code = "ENOENT";
    throw error;
  }

  const fileStats = await stat(requestedPath);
  return fileStats.isDirectory() ? join(requestedPath, "index.html") : requestedPath;
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
  });
  response.end(message);
}
