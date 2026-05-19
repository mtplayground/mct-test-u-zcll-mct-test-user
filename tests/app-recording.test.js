import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("recording state guard and countdown", () => {
  let originalFileReader;
  let originalMediaRecorder;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    originalFileReader = globalThis.FileReader;
    originalMediaRecorder = globalThis.MediaRecorder;
  });

  afterEach(() => {
    document.body.innerHTML = "";
    globalThis.FileReader = originalFileReader;
    globalThis.MediaRecorder = originalMediaRecorder;
    vi.useRealTimers();
    vi.doUnmock("../js/camera.js");
    vi.doUnmock("../js/storage.js");
    vi.doUnmock("../js/utils.js");
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("keeps isRecording true while a recording task runs and ticks once per second", async () => {
    const { isCurrentlyRecording, runRecordingTask } = await import("../js/app.js");
    const ticks = [];
    let resolveTask;
    const task = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveTask = resolve;
        }),
    );

    const resultPromise = runRecordingTask(task, {
      maxSeconds: 3,
      tick: (secondsLeft) => ticks.push(secondsLeft),
    });

    expect(isCurrentlyRecording()).toBe(true);
    expect(task).toHaveBeenCalledWith({ maxSeconds: 3 });
    expect(ticks).toEqual([3]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(ticks).toEqual([3, 2]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(ticks).toEqual([3, 2, 1]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(ticks).toEqual([3, 2, 1, 0]);
    expect(isCurrentlyRecording()).toBe(true);

    resolveTask("saved");
    await expect(resultPromise).resolves.toBe("saved");
    expect(isCurrentlyRecording()).toBe(false);
    expect(ticks).toEqual([3, 2, 1, 0]);
  });

  it("prevents a second recording while one is already running", async () => {
    const { isCurrentlyRecording, runRecordingTask } = await import("../js/app.js");
    let resolveTask;
    const firstTask = () =>
      new Promise((resolve) => {
        resolveTask = resolve;
      });

    const firstRecording = runRecordingTask(firstTask, {
      maxSeconds: 1,
      tick: () => {},
    });

    await expect(runRecordingTask(async () => null)).rejects.toThrow(
      "already in progress",
    );

    resolveTask();
    await firstRecording;
    expect(isCurrentlyRecording()).toBe(false);
  });

  it("clears recording state when the task rejects", async () => {
    const { isCurrentlyRecording, runRecordingTask } = await import("../js/app.js");

    await expect(
      runRecordingTask(
        async () => {
          throw new Error("Recorder failed.");
        },
        {
          maxSeconds: 5,
          tick: () => {},
        },
      ),
    ).rejects.toThrow("Recorder failed.");

    expect(isCurrentlyRecording()).toBe(false);
  });

  it("saves an early-stopped video and returns the UI to idle state", async () => {
    const fileReaderBlobs = [];
    const recorderInstances = [];
    const stream = { getTracks: vi.fn(() => []) };
    const addItem = vi.fn();

    globalThis.FileReader = createFileReaderStub(fileReaderBlobs);
    globalThis.MediaRecorder = createMediaRecorderStub({
      instances: recorderInstances,
      isTypeSupported: vi.fn(() => false),
      onStop: (recorder) => {
        recorder.emitChunk(new Blob(["short-video"], { type: "text/plain" }));
      },
    });

    vi.doMock("../js/camera.js", () => ({
      getStream: () => stream,
      startCamera: vi.fn(),
      stopCamera: vi.fn(),
      switchCamera: vi.fn(),
    }));
    vi.doMock("../js/storage.js", () => ({
      addItem,
      clearAll: vi.fn(),
      listItems: () => [],
      removeItem: vi.fn(),
      STORAGE_CHANGED_EVENT: "storage:changed",
      STORAGE_QUOTA_EXCEEDED_EVENT: "storage:quota-exceeded",
    }));
    vi.doMock("../js/utils.js", async () => {
      const actual = await vi.importActual("../js/utils.js");

      return {
        ...actual,
        newId: () => "early-video-id",
      };
    });

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
      <div id="gallery"></div>
    `;

    const { isCurrentlyRecording } = await import("../js/app.js");
    const recordButton = document.querySelector("#record-video");
    const indicator = document.querySelector("#recording-indicator");
    const countdown = document.querySelector("#recording-countdown");

    recordButton.click();
    await Promise.resolve();

    expect(recorderInstances).toHaveLength(1);
    expect(recordButton.textContent).toBe("Stop");
    expect(isCurrentlyRecording()).toBe(true);
    expect(indicator.hidden).toBe(false);

    await vi.advanceTimersByTimeAsync(4_250);
    recordButton.click();

    await vi.waitFor(() => {
      expect(addItem).toHaveBeenCalled();
    });

    const savedItem = addItem.mock.calls[0][0];
    expect(savedItem).toEqual({
      createdAt: expect.any(String),
      data: "data:video/webm;base64,c2hvcnQtdmlkZW8=",
      duration: 4.25,
      id: "early-video-id",
      type: "video",
    });
    expect(savedItem.duration).toBeLessThan(15);
    expect(fileReaderBlobs).toHaveLength(1);

    expect(isCurrentlyRecording()).toBe(false);
    expect(recordButton.disabled).toBe(false);
    expect(recordButton.textContent).toBe("Record");
    expect(recordButton.getAttribute("aria-pressed")).toBe("false");
    expect(recordButton.classList.contains("record-button--active")).toBe(false);
    expect(indicator.hidden).toBe(true);
    expect(countdown.textContent).toBe("");
    expect(document.querySelector("#camera-status").textContent).toBe(
      "Camera is ready.",
    );
    expect(document.querySelector("#start-camera").disabled).toBe(true);
    expect(document.querySelector("#stop-camera").disabled).toBe(false);
    expect(document.querySelector("#switch-camera").disabled).toBe(false);
    expect(document.querySelector("#take-picture").disabled).toBe(false);
  });
});

function createMediaRecorderStub({ instances, isTypeSupported, onStop = () => {} }) {
  return class MediaRecorderStub {
    static isTypeSupported = isTypeSupported;

    constructor(stream, options = {}) {
      this.mimeType = options.mimeType || "";
      this.ondataavailable = null;
      this.onerror = null;
      this.onstart = null;
      this.onstop = null;
      this.options = options;
      this.state = "inactive";
      this.stream = stream;
      instances.push(this);
    }

    start() {
      this.state = "recording";
      this.onstart?.();
    }

    stop() {
      if (this.state === "inactive") {
        return;
      }

      this.state = "inactive";
      onStop(this);
      this.onstop?.();
    }

    emitChunk(data) {
      this.ondataavailable?.({ data });
    }
  };
}

function createFileReaderStub(blobs) {
  return class FileReaderStub {
    constructor() {
      this.error = null;
      this.onload = null;
      this.onerror = null;
      this.result = null;
    }

    async readAsDataURL(blob) {
      blobs.push(blob);
      const text = await blob.text();
      const encoded = window.btoa(text);
      this.result = `data:${blob.type};base64,${encoded}`;
      this.onload?.();
    }
  };
}
