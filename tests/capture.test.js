import { afterEach, describe, expect, it, vi } from "vitest";

import { capturePicture } from "../js/capture.js";
import * as filterPipeline from "../js/filter.js";

describe("capturePicture", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the video frame through the shared canvas pipeline", () => {
    const videoEl = createVideoElement({ height: 480, width: 640 });
    const canvas = createCanvasStub("data:image/jpeg;base64,captured");
    const originalCreateElement = document.createElement.bind(document);
    const applyToCanvas = vi
      .spyOn(filterPipeline, "applyToCanvas")
      .mockImplementation(() => filterPipeline.filterSpec(0));

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
    expect(applyToCanvas).toHaveBeenCalledWith(canvas.context, videoEl, 640, 480, 0);
    expect(canvas.toDataURL).toHaveBeenCalledWith("image/jpeg", 0.9);
  });

  it("passes the requested beauty level to the canvas pipeline", () => {
    const videoEl = createVideoElement({ height: 720, width: 1280 });
    const canvas = createCanvasStub("data:image/jpeg;base64,filtered");
    const originalCreateElement = document.createElement.bind(document);
    const applyToCanvas = vi
      .spyOn(filterPipeline, "applyToCanvas")
      .mockImplementation(() => filterPipeline.filterSpec(45));

    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      if (tagName === "canvas") {
        return canvas;
      }

      return originalCreateElement(tagName);
    });

    expect(capturePicture(videoEl, { beautyLevel: 45 })).toBe(
      "data:image/jpeg;base64,filtered",
    );
    expect(applyToCanvas).toHaveBeenCalledWith(canvas.context, videoEl, 1280, 720, 45);
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
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
  };

  return {
    context,
    getContext: vi.fn(() => context),
    height: 0,
    toDataURL: vi.fn(() => dataUrl),
    width: 0,
  };
}
