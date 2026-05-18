import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getStream, startCamera, stopCamera } from "../js/camera.js";
import { getMediaDevicesErrorMessage } from "../js/errors.js";

describe("camera start and stop", () => {
  beforeEach(() => {
    stopCamera();
  });

  afterEach(() => {
    stopCamera();
    vi.unstubAllGlobals();
  });

  it("requests media with facingMode and attaches the stream to the video element", async () => {
    const videoEl = createVideoElement();
    const stream = createStream("front");
    const mediaDevices = {
      getUserMedia: vi.fn(async () => stream),
    };

    vi.stubGlobal("navigator", { mediaDevices });

    await expect(startCamera({ videoEl, facingMode: "user" })).resolves.toBe(stream);
    expect(getStream()).toBe(stream);
    expect(videoEl.srcObject).toBe(stream);
    expect(videoEl.autoplay).toBe(true);
    expect(videoEl.muted).toBe(true);
    expect(videoEl.playsInline).toBe(true);
    expect(mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: true,
      video: { facingMode: "user" },
    });
  });

  it("requests a generic video stream when facingMode is omitted", async () => {
    const videoEl = createVideoElement();
    const stream = createStream("default");
    const mediaDevices = {
      getUserMedia: vi.fn(async () => stream),
    };

    vi.stubGlobal("navigator", { mediaDevices });

    await startCamera({ videoEl });

    expect(mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: true,
      video: true,
    });
  });

  it("stops every active track and clears the attached video element", async () => {
    const videoEl = createVideoElement();
    const stream = createStream("back");
    const mediaDevices = {
      getUserMedia: vi.fn(async () => stream),
    };

    vi.stubGlobal("navigator", { mediaDevices });

    await startCamera({ videoEl, facingMode: "environment" });
    stopCamera();

    expect(stream.stoppedTracks).toEqual(["back-video", "back-audio"]);
    expect(getStream()).toBeNull();
    expect(videoEl.srcObject).toBeNull();
  });

  it("rejects when getUserMedia is unavailable", async () => {
    const videoEl = createVideoElement();

    vi.stubGlobal("navigator", {});

    await expect(startCamera({ videoEl })).rejects.toThrow(
      "Camera access is not supported",
    );
  });

  it("preserves MediaDevices rejections so callers can map friendly messages", async () => {
    const videoEl = createVideoElement();
    const error = new DOMException("Permission denied.", "NotAllowedError");
    const mediaDevices = {
      getUserMedia: vi.fn(async () => {
        throw error;
      }),
    };

    vi.stubGlobal("navigator", { mediaDevices });

    await expect(startCamera({ videoEl, facingMode: "user" })).rejects.toBe(error);
    expect(getStream()).toBeNull();
    expect(getMediaDevicesErrorMessage(error)).toContain("permission was blocked");
  });
});

function createVideoElement() {
  const videoEl = document.createElement("video");
  Object.defineProperty(videoEl, "srcObject", {
    configurable: true,
    value: null,
    writable: true,
  });
  return videoEl;
}

function createStream(deviceId) {
  const stoppedTracks = [];
  const videoTrack = createTrack(`${deviceId}-video`, deviceId, stoppedTracks);
  const audioTrack = createTrack(`${deviceId}-audio`, null, stoppedTracks);

  return {
    getTracks: () => [videoTrack, audioTrack],
    getVideoTracks: () => [videoTrack],
    stoppedTracks,
  };
}

function createTrack(id, deviceId, stoppedTracks) {
  return {
    kind: deviceId ? "video" : "audio",
    getSettings: () => (deviceId ? { deviceId } : {}),
    stop: () => stoppedTracks.push(id),
  };
}
