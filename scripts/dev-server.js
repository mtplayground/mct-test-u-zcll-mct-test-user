import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
loadDotEnv(resolve(rootDir, ".env"));

const host = process.env.HOST || "0.0.0.0";
const port = parsePort(process.env.PORT || "8080");

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

const server = createServer(async (request, response) => {
  try {
    if (!["GET", "HEAD"].includes(request.method || "")) {
      sendText(response, 405, "Method Not Allowed");
      return;
    }

    const requestUrl = new URL(request.url || "/", `http://${host}:${port}`);
    const filePath = await resolveRequestPath(requestUrl.pathname);
    const body = request.method === "HEAD" ? null : await readFile(filePath);

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": contentTypes.get(extname(filePath)) || "application/octet-stream",
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
});

server.listen(port, host);

server.on("error", (error) => {
  console.error(`Failed to start dev server: ${error.message}`);
  process.exitCode = 1;
});

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

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  try {
    const contents = readFileSync(filePath, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      process.env[key] ??= value.replace(/^["']|["']$/g, "");
    }
  } catch (error) {
    console.warn(`Could not read .env: ${error.message}`);
  }
}

function parsePort(value) {
  const portNumber = Number.parseInt(value, 10);

  if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
    console.error(`Invalid PORT "${value}". Use a number from 1 to 65535.`);
    process.exit(1);
  }

  return portNumber;
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
  });
  response.end(message);
}
