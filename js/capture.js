import * as filterPipeline from "./filter.js";

const JPEG_MIME_TYPE = "image/jpeg";
const JPEG_QUALITY = 0.9;
const DEFAULT_MAX_RECORDING_SECONDS = 15;
const DEFAULT_CAPTURE_STREAM_FPS = 30;
const VIDEO_MIME_TYPES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/mp4",
];
const filteredStreamCleanups = new WeakMap();

export function capturePicture(videoEl, { beautyLevel = 0 } = {}) {
  assertVideoElement(videoEl);

  const width = normalizeDimension(videoEl.videoWidth, "videoWidth");
  const height = normalizeDimension(videoEl.videoHeight, "videoHeight");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to create a 2D canvas context for picture capture.");
  }

  filterPipeline.applyToCanvas(context, videoEl, width, height, beautyLevel);
  return canvas.toDataURL(JPEG_MIME_TYPE, JPEG_QUALITY);
}

export async function recordVideo(
  stream,
  {
    getBeautyLevel = () => 0,
    maxSeconds = DEFAULT_MAX_RECORDING_SECONDS,
    onStart = noop,
  } = {},
) {
  assertMediaStream(stream);
  assertMediaRecorderAvailable();
  assertBeautyLevelCallback(getBeautyLevel);
  assertOnStartCallback(onStart);

  const durationLimit = normalizeMaxSeconds(maxSeconds);
  const recordingStream =
    normalizeBeautyLevel(getBeautyLevel()) > 0
      ? createFilteredStream(stream, getBeautyLevel)
      : stream;
  const mimeType = selectSupportedVideoMimeType();
  let recorder;
  try {
    recorder = mimeType
      ? new MediaRecorder(recordingStream, { mimeType })
      : new MediaRecorder(recordingStream);
  } catch (error) {
    if (recordingStream !== stream) {
      cleanupFilteredStream(recordingStream);
    }

    throw error;
  }
  const chunks = [];
  const startedAt = Date.now();
  const cleanupRecordingStream = () => {
    if (recordingStream !== stream) {
      cleanupFilteredStream(recordingStream);
    }
  };

  return new Promise((resolve, reject) => {
    let timeoutId = null;
    let settled = false;
    let startNotified = false;

    const rejectOnce = (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutId);
      cleanupRecordingStream();
      reject(error);
    };

    const stopRecorder = ({ allowAfterSettled = false } = {}) => {
      if ((!allowAfterSettled && settled) || recorder.state === "inactive") {
        return;
      }

      try {
        recorder.stop();
      } catch (error) {
        rejectOnce(error);
      }
    };

    const stop = () => {
      stopRecorder();
    };

    const notifyStart = () => {
      if (startNotified || recorder.state !== "recording") {
        return;
      }

      startNotified = true;

      try {
        onStart({ stop });
      } catch (error) {
        rejectOnce(error);
        stopRecorder({ allowAfterSettled: true });
      }
    };

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onstart = notifyStart;

    recorder.onerror = (event) => {
      rejectOnce(event.error || new Error("Video recording failed."));
    };

    recorder.onstop = () => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutId);
      cleanupRecordingStream();
      const duration = Math.min(durationLimit, (Date.now() - startedAt) / 1000);
      const outputMimeType = recorder.mimeType || mimeType || "video/webm";
      const blob = new Blob(chunks, { type: outputMimeType });

      blobToDataUrl(blob)
        .then((dataUrl) => {
          resolve({
            dataUrl,
            duration,
            mimeType: blob.type,
          });
        })
        .catch(reject);
    };

    recorder.start();
    notifyStart();

    if (!settled && recorder.state !== "inactive") {
      timeoutId = setTimeout(stop, durationLimit * 1000);
    }
  });
}

export function createFilteredStream(sourceStream, getBeautyLevel) {
  assertMediaStream(sourceStream);
  assertBeautyLevelCallback(getBeautyLevel);
  assertDocumentAvailable();

  const videoEl = document.createElement("video");
  videoEl.hidden = true;
  videoEl.muted = true;
  videoEl.playsInline = true;
  videoEl.srcObject = sourceStream;

  const canvas = document.createElement("canvas");
  canvas.hidden = true;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to create a 2D canvas context for filtered recording.");
  }

  const { height, width } = getStreamDimensions(sourceStream);
  canvas.width = width;
  canvas.height = height;
  mountHiddenElement(videoEl);
  mountHiddenElement(canvas);

  const canvasStream = captureCanvasStream(canvas);
  const filteredStream = createMergedMediaStream([
    ...canvasStream.getVideoTracks(),
    ...sourceStream.getAudioTracks(),
  ]);

  let animationFrameId = null;
  let videoFrameCallbackId = null;
  let stopped = false;

  const drawFrame = () => {
    if (stopped) {
      return;
    }

    syncCanvasDimensions(canvas, videoEl, sourceStream);

    if (canvas.width > 0 && canvas.height > 0) {
      filterPipeline.applyToCanvas(
        context,
        videoEl,
        canvas.width,
        canvas.height,
        getBeautyLevel(),
      );
    }

    scheduleFrame();
  };

  const scheduleFrame = () => {
    if (stopped) {
      return;
    }

    if (typeof videoEl.requestVideoFrameCallback === "function") {
      videoFrameCallbackId = videoEl.requestVideoFrameCallback(drawFrame);
      return;
    }

    animationFrameId = window.requestAnimationFrame(drawFrame);
  };

  const cleanup = () => {
    stopped = true;

    if (
      videoFrameCallbackId !== null &&
      typeof videoEl.cancelVideoFrameCallback === "function"
    ) {
      videoEl.cancelVideoFrameCallback(videoFrameCallbackId);
    }

    if (animationFrameId !== null) {
      window.cancelAnimationFrame(animationFrameId);
    }

    for (const track of canvasStream.getTracks()) {
      track.stop?.();
    }

    videoEl.pause?.();
    videoEl.removeAttribute("src");
    videoEl.srcObject = null;
    canvas.remove?.();
    videoEl.remove?.();
  };

  filteredStreamCleanups.set(filteredStream, cleanup);
  scheduleFrame();

  const playResult = videoEl.play?.();
  if (playResult && typeof playResult.catch === "function") {
    playResult.catch(noop);
  }

  return filteredStream;
}

function assertVideoElement(videoEl) {
  if (
    typeof HTMLVideoElement === "undefined" ||
    !(videoEl instanceof HTMLVideoElement)
  ) {
    throw new TypeError("capturePicture requires an HTMLVideoElement.");
  }
}

function normalizeDimension(value, fieldName) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${fieldName} must be available before capturing a picture.`);
  }

  return Math.floor(value);
}

function assertMediaStream(stream) {
  if (!stream || typeof stream.getTracks !== "function") {
    throw new TypeError("recordVideo requires a MediaStream.");
  }
}

function assertMediaRecorderAvailable() {
  if (typeof MediaRecorder !== "function") {
    throw new Error("MediaRecorder is not available in this browser.");
  }
}

function normalizeMaxSeconds(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new TypeError("maxSeconds must be a positive number.");
  }

  return value;
}

function assertOnStartCallback(onStart) {
  if (typeof onStart !== "function") {
    throw new TypeError("onStart must be a function.");
  }
}

function assertBeautyLevelCallback(getBeautyLevel) {
  if (typeof getBeautyLevel !== "function") {
    throw new TypeError("getBeautyLevel must be a function.");
  }
}

function assertDocumentAvailable() {
  if (typeof document === "undefined" || typeof document.createElement !== "function") {
    throw new Error("Filtered recording requires document.createElement.");
  }
}

function selectSupportedVideoMimeType() {
  if (typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }

  return (
    VIDEO_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || ""
  );
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Video recording could not be converted to a data URL."));
    };
    reader.onerror = () => {
      reject(reader.error || new Error("Video recording could not be read."));
    };
    reader.readAsDataURL(blob);
  });
}

function getStreamDimensions(sourceStream) {
  const videoTrack = sourceStream.getVideoTracks?.()[0];
  const settings =
    videoTrack && typeof videoTrack.getSettings === "function"
      ? videoTrack.getSettings()
      : {};

  return {
    height: normalizeOptionalDimension(settings.height, 480),
    width: normalizeOptionalDimension(settings.width, 640),
  };
}

function normalizeOptionalDimension(value, fallback) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function syncCanvasDimensions(canvas, videoEl, sourceStream) {
  const { height, width } =
    videoEl.videoWidth > 0 && videoEl.videoHeight > 0
      ? {
          height: Math.floor(videoEl.videoHeight),
          width: Math.floor(videoEl.videoWidth),
        }
      : getStreamDimensions(sourceStream);

  if (canvas.width !== width) {
    canvas.width = width;
  }

  if (canvas.height !== height) {
    canvas.height = height;
  }
}

function captureCanvasStream(canvas) {
  if (typeof canvas.captureStream !== "function") {
    throw new Error("Filtered recording requires canvas.captureStream.");
  }

  return canvas.captureStream(DEFAULT_CAPTURE_STREAM_FPS);
}

function createMergedMediaStream(tracks) {
  const MediaStreamConstructor = window.MediaStream;
  if (typeof MediaStreamConstructor !== "function") {
    throw new Error("Filtered recording requires MediaStream.");
  }

  return new MediaStreamConstructor(tracks);
}

function cleanupFilteredStream(stream) {
  const cleanup = filteredStreamCleanups.get(stream);
  if (!cleanup) {
    return;
  }

  filteredStreamCleanups.delete(stream);
  cleanup();
}

function mountHiddenElement(element) {
  element.setAttribute("aria-hidden", "true");
  element.style.display = "none";

  if (document.body) {
    document.body.append(element);
  }
}

function normalizeBeautyLevel(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(numberValue)));
}

function noop() {
  return undefined;
}
