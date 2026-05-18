import { afterEach, describe, expect, it, vi } from "vitest";

describe("camera control button wiring", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.doUnmock("../js/camera.js");
    vi.doUnmock("../js/capture.js");
    vi.doUnmock("../js/storage.js");
    vi.doUnmock("../js/utils.js");
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("starts, switches, stops, and updates camera control state", async () => {
    const stream = createStream();
    let currentStream = null;
    const startCamera = vi.fn(async () => {
      currentStream = stream;
      return stream;
    });
    const switchCamera = vi.fn(async () => stream);
    const stopCamera = vi.fn(() => {
      currentStream = null;
    });

    mockAppModules({
      camera: {
        getStream: () => currentStream,
        startCamera,
        stopCamera,
        switchCamera,
      },
    });
    document.body.innerHTML = createCameraControlsMarkup();

    await import("../js/app.js");

    const videoEl = document.querySelector("#camera-preview");
    const startButton = document.querySelector("#start-camera");
    const stopButton = document.querySelector("#stop-camera");
    const switchButton = document.querySelector("#switch-camera");
    const takePictureButton = document.querySelector("#take-picture");
    const recordButton = document.querySelector("#record-video");
    const status = document.querySelector("#camera-status");

    expect(startButton.disabled).toBe(false);
    expect(stopButton.disabled).toBe(true);
    expect(switchButton.disabled).toBe(true);
    expect(takePictureButton.disabled).toBe(true);
    expect(recordButton.disabled).toBe(true);
    expect(status.textContent).toBe("Camera is idle.");

    startButton.click();

    await vi.waitFor(() => {
      expect(startCamera).toHaveBeenCalledWith({
        facingMode: "environment",
        videoEl,
      });
    });
    expect(startButton.disabled).toBe(true);
    expect(stopButton.disabled).toBe(false);
    expect(switchButton.disabled).toBe(false);
    expect(takePictureButton.disabled).toBe(false);
    expect(recordButton.disabled).toBe(false);
    expect(status.textContent).toBe("Camera is ready.");

    switchButton.click();
    await vi.waitFor(() => {
      expect(switchCamera).toHaveBeenCalledTimes(1);
    });
    expect(status.textContent).toBe("Camera is ready.");

    stopButton.click();
    expect(stopCamera).toHaveBeenCalledTimes(1);
    expect(startButton.disabled).toBe(false);
    expect(stopButton.disabled).toBe(true);
    expect(switchButton.disabled).toBe(true);
    expect(takePictureButton.disabled).toBe(true);
    expect(recordButton.disabled).toBe(true);
    expect(status.textContent).toBe("Camera is idle.");
    expect(document.querySelector(".status-banner--info")?.textContent).toBe(
      "Camera stopped.",
    );
  });

  it("shows a friendly banner when camera start fails", async () => {
    const error = new DOMException("Permission denied.", "NotAllowedError");
    const startCamera = vi.fn(async () => {
      throw error;
    });

    mockAppModules({
      camera: {
        getStream: () => null,
        startCamera,
        stopCamera: vi.fn(),
        switchCamera: vi.fn(),
      },
    });
    document.body.innerHTML = createCameraControlsMarkup();

    await import("../js/app.js");
    document.querySelector("#start-camera").click();

    await vi.waitFor(() => {
      expect(document.querySelector(".status-banner--error")?.textContent).toContain(
        "Camera permission was blocked",
      );
    });
    expect(document.querySelector("#start-camera").disabled).toBe(false);
    expect(document.querySelector("#stop-camera").disabled).toBe(true);
    expect(document.querySelector("#switch-camera").disabled).toBe(true);
  });
});

function mockAppModules({ camera }) {
  vi.doMock("../js/camera.js", () => camera);
  vi.doMock("../js/capture.js", () => ({
    capturePicture: vi.fn(),
    recordVideo: vi.fn(),
  }));
  vi.doMock("../js/storage.js", () => ({
    addItem: vi.fn(),
    STORAGE_QUOTA_EXCEEDED_EVENT: "storage:quota-exceeded",
  }));
  vi.doMock("../js/utils.js", () => ({
    newId: () => "capture-id",
  }));
}

function createCameraControlsMarkup() {
  return `
    <div id="status-root" class="status-stack"></div>
    <p id="camera-status">Camera is idle.</p>
    <video id="camera-preview"></video>
    <button id="start-camera" type="button">Start</button>
    <button id="stop-camera" type="button">Stop</button>
    <button id="switch-camera" type="button">Switch</button>
    <button id="take-picture" type="button">Take Picture</button>
    <button id="record-video" type="button">Record</button>
  `;
}

function createStream() {
  return {
    getTracks: vi.fn(() => []),
  };
}
