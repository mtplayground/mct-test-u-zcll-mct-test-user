import * as filterPipeline from "./filter.js";

const JPEG_MIME_TYPE = "image/jpeg";
const JPEG_QUALITY = 0.9;
const DEFAULT_MAX_RECORDING_SECONDS = 15;
const VIDEO_MIME_TYPES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/mp4",
];

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
  { maxSeconds = DEFAULT_MAX_RECORDING_SECONDS, onStart = noop } = {},
) {
  assertMediaStream(stream);
  assertMediaRecorderAvailable();
  assertOnStartCallback(onStart);

  const durationLimit = normalizeMaxSeconds(maxSeconds);
  const mimeType = selectSupportedVideoMimeType();
  const recorder = mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream);
  const chunks = [];
  const startedAt = Date.now();

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

function noop() {
  return undefined;
}
