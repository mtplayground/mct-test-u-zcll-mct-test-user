import { getStream } from "./camera.js";
import { capturePicture, recordVideo } from "./capture.js";
import { initGallery } from "./gallery.js";
import { addItem } from "./storage.js";
import { initStatusEvents, showStatus } from "./ui.js";
import { newId } from "./utils.js";

const DEFAULT_RECORDING_SECONDS = 15;
let isRecording = false;

initApp();

export function initApp(root = document) {
  initGallery(root);
  initStatusEvents(root);

  const takePictureButton = root.querySelector("#take-picture");
  const recordVideoButton = root.querySelector("#record-video");
  const videoEl = root.querySelector("#camera-preview");

  if (takePictureButton && videoEl) {
    takePictureButton.addEventListener("click", () => {
      handleTakePicture(videoEl);
    });
  }

  if (recordVideoButton) {
    recordVideoButton.addEventListener("click", () => {
      handleRecordVideo({
        countdownEl: root.querySelector("#recording-countdown"),
        indicatorEl: root.querySelector("#recording-indicator"),
        recordButton: recordVideoButton,
      });
    });
  }
}

export function handleTakePicture(videoEl) {
  try {
    const data = capturePicture(videoEl);
    addItem({
      createdAt: new Date().toISOString(),
      data,
      id: newId(),
      type: "picture",
    });
    showStatus("success", "Picture saved.");
  } catch (error) {
    showStatus("error", getErrorMessage(error));
  }
}

export function isCurrentlyRecording() {
  return isRecording;
}

export async function handleRecordVideo({
  countdownEl = null,
  indicatorEl = null,
  recordButton = null,
} = {}) {
  if (isRecording) {
    return;
  }

  const stream = getStream();
  if (!stream) {
    showStatus("error", "Start the camera before recording.");
    return;
  }

  setRecordButtonDisabled(recordButton, true);

  try {
    const recording = await runRecordingTask(
      ({ maxSeconds }) => recordVideo(stream, { maxSeconds }),
      {
        maxSeconds: DEFAULT_RECORDING_SECONDS,
        tick: (secondsLeft) => {
          showRecordingIndicator(indicatorEl, countdownEl, secondsLeft);
        },
      },
    );

    addItem({
      createdAt: new Date().toISOString(),
      data: recording.dataUrl,
      duration: recording.duration,
      id: newId(),
      type: "video",
    });
    showStatus("success", "Video saved.");
  } catch (error) {
    showStatus("error", getErrorMessage(error, "Could not save video."));
  } finally {
    hideRecordingIndicator(indicatorEl);
    setRecordButtonDisabled(recordButton, false);
  }
}

export async function runRecordingTask(
  recordingTask,
  { maxSeconds = DEFAULT_RECORDING_SECONDS, tick = noop } = {},
) {
  if (isRecording) {
    throw new Error("A recording is already in progress.");
  }

  if (typeof recordingTask !== "function") {
    throw new TypeError("runRecordingTask requires a recording task function.");
  }

  if (typeof tick !== "function") {
    throw new TypeError("tick must be a function.");
  }

  const duration = normalizeRecordingSeconds(maxSeconds);
  isRecording = true;
  const stopTicker = startCountdownTicker(duration, tick);

  try {
    return await recordingTask({ maxSeconds: duration });
  } finally {
    stopTicker();
    isRecording = false;
  }
}

export function formatCountdown(seconds) {
  const totalSeconds = Math.max(0, Math.ceil(Number(seconds) || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(
    2,
    "0",
  )}`;
}

function getErrorMessage(error, fallback = "Could not save picture.") {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function showRecordingIndicator(indicatorEl, countdownEl, secondsLeft) {
  if (countdownEl) {
    countdownEl.textContent = formatCountdown(secondsLeft);
  }

  if (indicatorEl) {
    indicatorEl.hidden = false;
  }
}

function hideRecordingIndicator(indicatorEl) {
  if (indicatorEl) {
    indicatorEl.hidden = true;
  }
}

function setRecordButtonDisabled(recordButton, disabled) {
  if (recordButton) {
    recordButton.disabled = disabled;
  }
}

function startCountdownTicker(maxSeconds, tick) {
  let secondsLeft = Math.ceil(maxSeconds);
  let lastTick = null;
  const emitTick = (value) => {
    if (value === lastTick) {
      return;
    }

    lastTick = value;
    tick(value);
  };

  emitTick(secondsLeft);
  const intervalId = setInterval(() => {
    secondsLeft = Math.max(0, secondsLeft - 1);
    emitTick(secondsLeft);

    if (secondsLeft === 0) {
      clearInterval(intervalId);
    }
  }, 1000);

  return () => {
    clearInterval(intervalId);
    emitTick(0);
  };
}

function normalizeRecordingSeconds(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new TypeError("maxSeconds must be a positive number.");
  }

  return value;
}

function noop() {
  return undefined;
}
