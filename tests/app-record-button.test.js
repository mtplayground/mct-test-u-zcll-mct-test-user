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

  it("records from the active stream, disables the button, shows countdown, and saves a video item", async () => {
    let finishRecording;
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
    const indicator = document.querySelector("#recording-indicator");
    const countdown = document.querySelector("#recording-countdown");
    recordButton.click();
    await Promise.resolve();

    expect(recordVideo).toHaveBeenCalledWith(stream, { maxSeconds: 15 });
    expect(recordButton.disabled).toBe(true);
    expect(indicator.hidden).toBe(false);
    expect(countdown.textContent).toBe("00:15");

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
    expect(indicator.hidden).toBe(true);
    expect(document.querySelector(".toast--success")?.textContent).toBe("Video saved.");
  });

  it("shows an error when recording starts without an active stream", async () => {
    const recordVideo = vi.fn();
    const addItem = vi.fn();

    vi.doMock("../js/camera.js", () => ({
      getStream: () => null,
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

    document.querySelector("#record-video").click();

    expect(recordVideo).not.toHaveBeenCalled();
    expect(addItem).not.toHaveBeenCalled();
    expect(document.querySelector(".toast--error")?.textContent).toBe(
      "Start the camera before recording.",
    );
  });
});
