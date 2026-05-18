import { describe, expect, it } from "vitest";

const modules = [
  ["app", "../js/app.js"],
  ["camera", "../js/camera.js"],
  ["capture", "../js/capture.js"],
  ["errors", "../js/errors.js"],
  ["gallery", "../js/gallery.js"],
  ["storage", "../js/storage.js"],
  ["ui", "../js/ui.js"],
  ["utils", "../js/utils.js"],
];

describe("module graph", () => {
  it.each(modules)("loads the %s module", async (_name, modulePath) => {
    await expect(import(modulePath)).resolves.toBeDefined();
  });
});
