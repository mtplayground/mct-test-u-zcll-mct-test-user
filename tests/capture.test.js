import { afterEach, describe, expect, it, vi } from "vitest";

import { capturePicture } from "../js/capture.js";

describe("capturePicture", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("draws the video frame to an intrinsic-size canvas and returns a JPEG data URL", () => {
    const videoEl = createVideoElement({ height: 480, width: 640 });
    const canvas = createCanvasStub("data:image/jpeg;base64,captured");
    const originalCreateElement = document.createElement.bind(document);

    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      if (tagName === "canvas") {
        return canvas;
      }

      return originalCreateElement(tagName);
    });

    const dataUrl = capturePicture(videoEl);

    expect(dataUrl.startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(480);
    expect(canvas.getContext).toHaveBeenCalledWith("2d");
    expect(canvas.context.drawImage).toHaveBeenCalledWith(videoEl, 0, 0, 640, 480);
    expect(canvas.toDataURL).toHaveBeenCalledWith("image/jpeg", 0.9);
  });

  it("rejects videos before intrinsic dimensions are available", () => {
    const videoEl = createVideoElement({ height: 0, width: 0 });

    expect(() => capturePicture(videoEl)).toThrow("videoWidth must be available");
  });
});

function createVideoElement({ height, width }) {
  const videoEl = document.createElement("video");
  Object.defineProperty(videoEl, "videoWidth", {
    configurable: true,
    value: width,
  });
  Object.defineProperty(videoEl, "videoHeight", {
    configurable: true,
    value: height,
  });
  return videoEl;
}

function createCanvasStub(dataUrl) {
  const context = {
    drawImage: vi.fn(),
  };

  return {
    context,
    getContext: vi.fn(() => context),
    height: 0,
    toDataURL: vi.fn(() => dataUrl),
    width: 0,
  };
}
