import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getStream, startCamera, stopCamera, switchCamera } from "../js/camera.js";

describe("camera switching", () => {
  beforeEach(() => {
    stopCamera();
  });

  afterEach(() => {
    stopCamera();
    vi.unstubAllGlobals();
  });

  it("toggles facingMode between environment and user", async () => {
    const videoEl = createVideoElement();
    const backStream = createStream("back");
    const frontStream = createStream("front");
    const mediaDevices = createMediaDevices([backStream, frontStream]);

    vi.stubGlobal("navigator", { mediaDevices });

    await startCamera({ videoEl, facingMode: "environment" });
    const switchedStream = await switchCamera();

    expect(switchedStream).toBe(frontStream);
    expect(getStream()).toBe(frontStream);
    expect(videoEl.srcObject).toBe(frontStream);
    expect(backStream.stoppedTracks).toEqual(["back-video", "back-audio"]);
    expect(mediaDevices.getUserMedia).toHaveBeenNthCalledWith(1, {
      audio: true,
      video: { facingMode: "environment" },
    });
    expect(mediaDevices.getUserMedia).toHaveBeenNthCalledWith(2, {
      audio: true,
      video: { facingMode: "user" },
    });
  });

  it("falls back to the next videoinput when facingMode returns the same device", async () => {
    const videoEl = createVideoElement();
    const originalStream = createStream("back");
    const sameDeviceStream = createStream("back");
    const fallbackStream = createStream("front");
    const mediaDevices = createMediaDevices(
      [originalStream, sameDeviceStream, fallbackStream],
      [
        { kind: "videoinput", deviceId: "back" },
        { kind: "videoinput", deviceId: "front" },
      ],
    );

    vi.stubGlobal("navigator", { mediaDevices });

    await startCamera({ videoEl, facingMode: "environment" });
    const switchedStream = await switchCamera();

    expect(switchedStream).toBe(fallbackStream);
    expect(getStream()).toBe(fallbackStream);
    expect(videoEl.srcObject).toBe(fallbackStream);
    expect(originalStream.stoppedTracks).toEqual(["back-video", "back-audio"]);
    expect(sameDeviceStream.stoppedTracks).toEqual(["back-video", "back-audio"]);
    expect(mediaDevices.enumerateDevices).toHaveBeenCalledTimes(1);
    expect(mediaDevices.getUserMedia).toHaveBeenNthCalledWith(3, {
      audio: true,
      video: {
        deviceId: {
          exact: "front",
        },
      },
    });
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

function createMediaDevices(streams, devices = []) {
  const queue = [...streams];

  return {
    enumerateDevices: vi.fn(async () => devices),
    getUserMedia: vi.fn(async () => {
      const stream = queue.shift();
      if (!stream) {
        throw new Error("No mocked stream available.");
      }

      return stream;
    }),
  };
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
