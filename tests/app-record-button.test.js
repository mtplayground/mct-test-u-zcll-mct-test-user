import { afterEach, describe, expect, it, vi } from "vitest";

describe("record button UI wiring", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.doUnmock("../js/camera.js");
    vi.doUnmock("../js/capture.js");
    vi.doUnmock("../js/storage.js");
    vi.doUnmock("../js/utils.js");
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("records from the active stream, turns Record into Stop, and saves a video item", async () => {
    let finishRecording;
    const stopRecording = vi.fn();
    const stream = { getTracks: vi.fn(() => []) };
    const recordVideo = vi.fn(
      () =>
        new Promise((resolve) => {
          finishRecording = resolve;
        }),
    );
    const addItem = vi.fn();

    vi.doMock("../js/camera.js", () => ({
      getStream: () => stream,
      startCamera: vi.fn(),
      stopCamera: vi.fn(),
      switchCamera: vi.fn(),
    }));
    vi.doMock("../js/capture.js", () => ({
      capturePicture: vi.fn(),
      recordVideo,
    }));
    vi.doMock("../js/storage.js", () => ({
      addItem,
      STORAGE_QUOTA_EXCEEDED_EVENT: "storage:quota-exceeded",
    }));
    vi.doMock("../js/utils.js", () => ({
      newId: () => "video-id",
    }));

    document.body.innerHTML = `
      <p id="camera-status"></p>
      <button id="start-camera" type="button">Start</button>
      <button id="stop-camera" type="button">Stop</button>
      <button id="switch-camera" type="button">Switch</button>
      <button id="take-picture" type="button">Take Picture</button>
      <button id="record-video" type="button">Record</button>
      <div id="recording-indicator" hidden>
        <span id="recording-countdown">00:15</span>
      </div>
    `;

    await import("../js/app.js");

    const recordButton = document.querySelector("#record-video");
    const indicator = document.querySelector("#recording-indicator");
    const countdown = document.querySelector("#recording-countdown");
    recordButton.click();
    await Promise.resolve();

    expect(recordVideo).toHaveBeenCalledWith(stream, {
      maxSeconds: 15,
      onStart: expect.any(Function),
    });
    recordVideo.mock.calls[0][1].onStart({ stop: stopRecording });

    expect(recordButton.disabled).toBe(false);
    expect(recordButton.textContent).toBe("Stop");
    expect(recordButton.getAttribute("aria-label")).toBe("Stop recording");
    expect(recordButton.getAttribute("aria-pressed")).toBe("true");
    expect(recordButton.classList.contains("record-button--active")).toBe(true);
    expect(document.querySelector("#start-camera").disabled).toBe(true);
    expect(document.querySelector("#stop-camera").disabled).toBe(true);
    expect(document.querySelector("#switch-camera").disabled).toBe(true);
    expect(document.querySelector("#take-picture").disabled).toBe(true);
    expect(indicator.hidden).toBe(false);
    expect(countdown.textContent).toBe("00:15");

    recordButton.click();
    expect(stopRecording).toHaveBeenCalledTimes(1);
    expect(recordVideo).toHaveBeenCalledTimes(1);
    expect(recordButton.textContent).toBe("Stop");
    expect(recordButton.getAttribute("aria-pressed")).toBe("true");
    expect(indicator.hidden).toBe(false);

    finishRecording({
      dataUrl: "data:video/webm;base64,AAAA",
      duration: 12.25,
      mimeType: "video/webm",
    });

    await vi.waitFor(() => {
      expect(addItem).toHaveBeenCalledWith({
        createdAt: expect.any(String),
        data: "data:video/webm;base64,AAAA",
        duration: 12.25,
        id: "video-id",
        type: "video",
      });
    });

    expect(recordButton.disabled).toBe(false);
    expect(recordButton.textContent).toBe("Record");
    expect(recordButton.getAttribute("aria-label")).toBe("Record");
    expect(recordButton.getAttribute("aria-pressed")).toBe("false");
    expect(recordButton.classList.contains("record-button--active")).toBe(false);
    expect(document.querySelector("#start-camera").disabled).toBe(true);
    expect(document.querySelector("#stop-camera").disabled).toBe(false);
    expect(document.querySelector("#switch-camera").disabled).toBe(false);
    expect(document.querySelector("#take-picture").disabled).toBe(false);
    expect(indicator.hidden).toBe(true);
    expect(countdown.textContent).toBe("");
    expect(document.querySelector(".toast--success")?.textContent).toBe("Video saved.");
  });

  it("shows an error when recording starts without an active stream", async () => {
    const recordVideo = vi.fn();
    const addItem = vi.fn();

    vi.doMock("../js/camera.js", () => ({
      getStream: () => null,
      startCamera: vi.fn(),
      stopCamera: vi.fn(),
      switchCamera: vi.fn(),
    }));
    vi.doMock("../js/capture.js", () => ({
      capturePicture: vi.fn(),
      recordVideo,
    }));
    vi.doMock("../js/storage.js", () => ({
      addItem,
      STORAGE_QUOTA_EXCEEDED_EVENT: "storage:quota-exceeded",
    }));
    vi.doMock("../js/utils.js", () => ({
      newId: () => "video-id",
    }));

    document.body.innerHTML = `
      <button id="record-video" type="button">Record</button>
      <div id="recording-indicator" hidden>
        <span id="recording-countdown">00:15</span>
      </div>
    `;

    await import("../js/app.js");

    const recordButton = document.querySelector("#record-video");
    expect(recordButton.disabled).toBe(true);
    recordButton.click();

    expect(recordVideo).not.toHaveBeenCalled();
    expect(addItem).not.toHaveBeenCalled();
  });
});
