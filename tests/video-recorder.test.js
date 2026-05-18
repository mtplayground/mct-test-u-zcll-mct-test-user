import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { recordVideo } from "../js/capture.js";

describe("recordVideo", () => {
  let originalFileReader;
  let originalMediaRecorder;
  let fileReaderBlobs;
  let recorderInstances;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    fileReaderBlobs = [];
    recorderInstances = [];
    originalFileReader = globalThis.FileReader;
    originalMediaRecorder = globalThis.MediaRecorder;
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.FileReader = originalFileReader;
    globalThis.MediaRecorder = originalMediaRecorder;
    vi.restoreAllMocks();
  });

  it("selects the best supported mime type, auto-stops at 15s, and concatenates chunks", async () => {
    const stopCalls = [];

    globalThis.FileReader = createFileReaderStub(fileReaderBlobs);
    globalThis.MediaRecorder = createMediaRecorderStub({
      instances: recorderInstances,
      isTypeSupported: vi.fn((mimeType) => mimeType === "video/webm;codecs=vp8"),
      onStop: (recorder) => {
        stopCalls.push(recorder);
        recorder.emitChunk(new Blob(["first"], { type: "text/plain" }));
        recorder.emitChunk(new Blob(["second"], { type: "text/plain" }));
      },
    });

    const stream = createStream();
    const recording = recordVideo(stream);
    const recorder = recorderInstances[0];

    expect(globalThis.MediaRecorder.isTypeSupported).toHaveBeenCalledWith(
      "video/webm;codecs=vp9",
    );
    expect(globalThis.MediaRecorder.isTypeSupported).toHaveBeenCalledWith(
      "video/webm;codecs=vp8",
    );
    expect(globalThis.MediaRecorder.isTypeSupported).not.toHaveBeenCalledWith(
      "video/mp4",
    );
    expect(recorder.stream).toBe(stream);
    expect(recorder.options).toEqual({ mimeType: "video/webm;codecs=vp8" });
    expect(recorder.state).toBe("recording");

    await vi.advanceTimersByTimeAsync(14_999);
    expect(stopCalls).toHaveLength(0);
    expect(recorder.state).toBe("recording");

    await vi.advanceTimersByTimeAsync(1);
    const result = await recording;

    expect(stopCalls).toEqual([recorder]);
    expect(fileReaderBlobs).toHaveLength(1);
    await expect(fileReaderBlobs[0].text()).resolves.toBe("firstsecond");
    expect(fileReaderBlobs[0].type).toBe("video/webm;codecs=vp8");
    expect(result).toEqual({
      dataUrl: "data:video/webm;codecs=vp8;base64,Zmlyc3RzZWNvbmQ=",
      duration: 15,
      mimeType: "video/webm;codecs=vp8",
    });
  });

  it("uses the default MediaRecorder options when no preferred mime type is supported", async () => {
    globalThis.FileReader = createFileReaderStub(fileReaderBlobs);
    globalThis.MediaRecorder = createMediaRecorderStub({
      instances: recorderInstances,
      isTypeSupported: vi.fn(() => false),
      onStop: (recorder) => {
        recorder.emitChunk(new Blob(["fallback"]));
      },
    });

    const recording = recordVideo(createStream(), { maxSeconds: 2 });
    const recorder = recorderInstances[0];

    expect(recorder.options).toEqual({});

    await vi.advanceTimersByTimeAsync(2_000);
    const result = await recording;

    expect(fileReaderBlobs[0].type).toBe("video/webm");
    expect(result.mimeType).toBe("video/webm");
    expect(result.duration).toBe(2);
  });

  it("rejects an invalid stream before creating a recorder", async () => {
    const Recorder = createMediaRecorderStub({
      instances: recorderInstances,
      isTypeSupported: vi.fn(),
    });
    globalThis.MediaRecorder = Recorder;

    await expect(recordVideo(null)).rejects.toThrow("requires a MediaStream");
    expect(recorderInstances).toHaveLength(0);
  });
});

function createMediaRecorderStub({ instances, isTypeSupported, onStop = () => {} }) {
  return class MediaRecorderStub {
    static isTypeSupported = isTypeSupported;

    constructor(stream, options = {}) {
      this.mimeType = options.mimeType || "";
      this.ondataavailable = null;
      this.onerror = null;
      this.onstop = null;
      this.options = options;
      this.state = "inactive";
      this.stream = stream;
      instances.push(this);
    }

    start() {
      this.state = "recording";
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

function createStream() {
  return {
    getTracks: vi.fn(() => []),
  };
}
