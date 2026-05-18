import { capturePicture } from "./capture.js";
import { addItem } from "./storage.js";
import { newId } from "./utils.js";

const TOAST_DURATION_MS = 4000;
const DEFAULT_RECORDING_SECONDS = 15;
let isRecording = false;

initApp();

export function initApp(root = document) {
  const takePictureButton = root.querySelector("#take-picture");
  const videoEl = root.querySelector("#camera-preview");

  if (!takePictureButton || !videoEl) {
    return;
  }

  takePictureButton.addEventListener("click", () => {
    handleTakePicture(videoEl);
  });
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
    showToast("Picture saved.", "success");
  } catch (error) {
    showToast(getErrorMessage(error), "error");
  }
}

export function isCurrentlyRecording() {
  return isRecording;
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

function showToast(message, variant) {
  const toast = document.createElement("div");
  toast.className = `toast toast--${variant}`;
  toast.setAttribute("role", variant === "error" ? "alert" : "status");
  toast.textContent = message;

  getToastContainer().append(toast);
  setTimeout(() => {
    toast.remove();
  }, TOAST_DURATION_MS);
}

function getToastContainer() {
  let container = document.querySelector("#toast-root");

  if (!container) {
    container = document.createElement("div");
    container.id = "toast-root";
    container.className = "toast-stack";
    container.setAttribute("aria-live", "polite");
    container.setAttribute("aria-atomic", "false");
    document.body.append(container);
  }

  return container;
}

function getErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Could not save picture.";
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
