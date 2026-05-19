import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { recordVideo } from "../js/capture.js";
import * as filterPipeline from "../js/filter.js";

describe("recordVideo", () => {
  let originalFileReader;
  let originalMediaRecorder;
  let originalMediaStream;
  let originalRequestAnimationFrame;
  let originalCancelAnimationFrame;
  let fileReaderBlobs;
  let recorderInstances;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    fileReaderBlobs = [];
    recorderInstances = [];
    originalFileReader = globalThis.FileReader;
    originalMediaRecorder = globalThis.MediaRecorder;
    originalMediaStream = window.MediaStream;
    originalRequestAnimationFrame = window.requestAnimationFrame;
    originalCancelAnimationFrame = window.cancelAnimationFrame;
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.FileReader = originalFileReader;
    globalThis.MediaRecorder = originalMediaRecorder;
    window.MediaStream = originalMediaStream;
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
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

  it("stops early through the onStart handle, finalizes once, and reports elapsed duration", async () => {
    const stopCalls = [];
    let stopHandle;

    globalThis.FileReader = createFileReaderStub(fileReaderBlobs);
    globalThis.MediaRecorder = createMediaRecorderStub({
      instances: recorderInstances,
      isTypeSupported: vi.fn(() => false),
      onStop: (recorder) => {
        stopCalls.push(recorder);
        recorder.emitChunk(new Blob(["early"], { type: "text/plain" }));
      },
    });

    const recording = recordVideo(createStream(), {
      maxSeconds: 15,
      onStart: ({ stop }) => {
        stopHandle = stop;
      },
    });
    const recorder = recorderInstances[0];

    expect(recorder.state).toBe("recording");
    expect(stopHandle).toEqual(expect.any(Function));

    await vi.advanceTimersByTimeAsync(4_250);
    stopHandle();
    stopHandle();

    const result = await recording;

    expect(stopCalls).toEqual([recorder]);
    expect(fileReaderBlobs).toHaveLength(1);
    await expect(fileReaderBlobs[0].text()).resolves.toBe("early");
    expect(result.duration).toBe(4.25);
    expect(result.duration).toBeLessThan(15);

    await vi.advanceTimersByTimeAsync(11_000);
    expect(stopCalls).toHaveLength(1);
    expect(fileReaderBlobs).toHaveLength(1);
  });

  it("records the raw stream when the beauty level starts at 0", async () => {
    globalThis.FileReader = createFileReaderStub(fileReaderBlobs);
    globalThis.MediaRecorder = createMediaRecorderStub({
      instances: recorderInstances,
      isTypeSupported: vi.fn(() => false),
      onStop: (recorder) => {
        recorder.emitChunk(new Blob(["raw"], { type: "text/plain" }));
      },
    });

    const stream = createStream();
    const recording = recordVideo(stream, {
      getBeautyLevel: () => 0,
      maxSeconds: 1,
    });
    const recorder = recorderInstances[0];

    expect(recorder.stream).toBe(stream);

    await vi.advanceTimersByTimeAsync(1_000);
    await expect(recording).resolves.toMatchObject({
      dataUrl: "data:video/webm;base64,cmF3",
      duration: 1,
    });
  });

  it("records a filtered stream when the beauty level starts above 0", async () => {
    const audioTrack = createTrack("audio");
    const canvasTrack = createTrack("video");
    const rafCallbacks = [];
    const { canvas, video } = mockFilteredDom({ canvasTrack, rafCallbacks });
    const sourceStream = createStream({
      audioTracks: [audioTrack],
      videoTracks: [createTrack("video", { height: 720, width: 1280 })],
    });
    const applyToCanvas = vi.spyOn(filterPipeline, "applyToCanvas");

    globalThis.FileReader = createFileReaderStub(fileReaderBlobs);
    globalThis.MediaRecorder = createMediaRecorderStub({
      instances: recorderInstances,
      isTypeSupported: vi.fn(() => false),
      onStop: (recorder) => {
        recorder.emitChunk(new Blob(["filtered"], { type: "text/plain" }));
      },
    });

    let currentBeautyLevel = 60;
    const recording = recordVideo(sourceStream, {
      getBeautyLevel: () => currentBeautyLevel,
      maxSeconds: 1,
    });
    const recorder = recorderInstances[0];

    expect(recorder.stream).not.toBe(sourceStream);
    expect(recorder.stream.getVideoTracks()).toEqual([canvasTrack]);
    expect(recorder.stream.getAudioTracks()).toEqual([audioTrack]);
    expect(canvas.width).toBe(1280);
    expect(canvas.height).toBe(720);
    expect(video.srcObject).toBe(sourceStream);

    currentBeautyLevel = 35;
    rafCallbacks.shift()();

    expect(applyToCanvas).toHaveBeenCalledWith(
      canvas.context,
      video,
      1280,
      720,
      35,
    );

    await vi.advanceTimersByTimeAsync(1_000);
    await expect(recording).resolves.toMatchObject({
      dataUrl: "data:video/webm;base64,ZmlsdGVyZWQ=",
      duration: 1,
    });
    expect(canvasTrack.stop).toHaveBeenCalledTimes(1);
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

function createStream({ audioTracks = [], tracks, videoTracks = [] } = {}) {
  const allTracks = tracks || [...videoTracks, ...audioTracks];

  return {
    getAudioTracks: vi.fn(() => audioTracks),
    getTracks: vi.fn(() => allTracks),
    getVideoTracks: vi.fn(() => videoTracks),
  };
}

function createTrack(kind, settings = {}) {
  return {
    getSettings: vi.fn(() => settings),
    kind,
    stop: vi.fn(),
  };
}

function mockFilteredDom({ canvasTrack, rafCallbacks }) {
  const originalCreateElement = document.createElement.bind(document);
  const video = {
    hidden: false,
    muted: false,
    pause: vi.fn(),
    play: vi.fn(() => Promise.resolve()),
    playsInline: false,
    remove: vi.fn(),
    removeAttribute: vi.fn(),
    setAttribute: vi.fn(),
    srcObject: null,
    style: {},
    videoHeight: 720,
    videoWidth: 1280,
  };
  const canvas = {
    captureStream: vi.fn(() =>
      createStream({
        tracks: [canvasTrack],
        videoTracks: [canvasTrack],
      }),
    ),
    context: createContextStub(),
    getContext: vi.fn(() => canvas.context),
    height: 0,
    hidden: false,
    remove: vi.fn(),
    setAttribute: vi.fn(),
    style: {},
    width: 0,
  };

  vi.spyOn(document, "createElement").mockImplementation((tagName) => {
    if (tagName === "video") {
      return video;
    }

    if (tagName === "canvas") {
      return canvas;
    }

    return originalCreateElement(tagName);
  });
  vi.spyOn(document.body, "append").mockImplementation(() => {});
  window.requestAnimationFrame = vi.fn((callback) => {
    rafCallbacks.push(callback);
    return rafCallbacks.length;
  });
  window.cancelAnimationFrame = vi.fn();
  window.MediaStream = class MediaStreamStub {
    constructor(tracks = []) {
      this.tracks = tracks;
    }

    getAudioTracks() {
      return this.tracks.filter((track) => track.kind === "audio");
    }

    getTracks() {
      return this.tracks;
    }

    getVideoTracks() {
      return this.tracks.filter((track) => track.kind === "video");
    }
  };

  return { canvas, video };
}

function createContextStub() {
  return {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
  };
}
