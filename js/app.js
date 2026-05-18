import { getStream, startCamera, stopCamera, switchCamera } from "./camera.js";
import { capturePicture, recordVideo } from "./capture.js";
import { getMediaDevicesErrorMessage } from "./errors.js";
import { initGallery } from "./gallery.js";
import { addItem } from "./storage.js";
import { initStatusEvents, showStatus } from "./ui.js";
import { newId } from "./utils.js";

const DEFAULT_RECORDING_SECONDS = 15;
const DEFAULT_FACING_MODE = "environment";
let isRecording = false;
let isCameraBusy = false;

initApp();

export function initApp(root = document) {
  initGallery(root);
  initStatusEvents(root);

  const takePictureButton = root.querySelector("#take-picture");
  const recordVideoButton = root.querySelector("#record-video");
  const startCameraButton = root.querySelector("#start-camera");
  const stopCameraButton = root.querySelector("#stop-camera");
  const switchCameraButton = root.querySelector("#switch-camera");
  const statusEl = root.querySelector("#camera-status");
  const videoEl = root.querySelector("#camera-preview");
  const controls = {
    recordVideoButton,
    startCameraButton,
    statusEl,
    stopCameraButton,
    switchCameraButton,
    takePictureButton,
  };

  updateControlState(controls);

  if (startCameraButton && videoEl) {
    startCameraButton.addEventListener("click", () => {
      handleStartCamera(videoEl, controls);
    });
  }

  if (stopCameraButton) {
    stopCameraButton.addEventListener("click", () => {
      handleStopCamera(controls);
    });
  }

  if (switchCameraButton) {
    switchCameraButton.addEventListener("click", () => {
      handleSwitchCamera(controls);
    });
  }

  if (takePictureButton && videoEl) {
    takePictureButton.addEventListener("click", () => {
      handleTakePicture(videoEl);
    });
  }

  if (recordVideoButton) {
    recordVideoButton.addEventListener("click", () => {
      handleRecordVideo({
        countdownEl: root.querySelector("#recording-countdown"),
        controls,
        indicatorEl: root.querySelector("#recording-indicator"),
        recordButton: recordVideoButton,
      });
    });
  }
}

export async function handleStartCamera(videoEl, controls = {}) {
  if (isCameraBusy || isRecording) {
    return;
  }

  isCameraBusy = true;
  updateControlState(controls);

  try {
    await startCamera({ facingMode: DEFAULT_FACING_MODE, videoEl });
    showStatus("success", "Camera started.");
  } catch (error) {
    showStatus("error", getCameraErrorMessage(error));
  } finally {
    isCameraBusy = false;
    updateControlState(controls);
  }
}

export function handleStopCamera(controls = {}) {
  if (isRecording) {
    return;
  }

  stopCamera();
  showStatus("info", "Camera stopped.");
  updateControlState(controls);
}

export async function handleSwitchCamera(controls = {}) {
  if (isCameraBusy || isRecording || !getStream()) {
    return;
  }

  isCameraBusy = true;
  updateControlState(controls);

  try {
    await switchCamera();
    showStatus("success", "Camera switched.");
  } catch (error) {
    showStatus("error", getCameraErrorMessage(error));
  } finally {
    isCameraBusy = false;
    updateControlState(controls);
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
  controls = {},
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
  updateControlState(controls, { recording: true });

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
    updateControlState(controls);
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

function getCameraErrorMessage(error) {
  if (
    (typeof DOMException !== "undefined" && error instanceof DOMException) ||
    hasNamedMediaError(error)
  ) {
    return getMediaDevicesErrorMessage(error);
  }

  return getErrorMessage(error, "Camera action failed.");
}

function hasNamedMediaError(error) {
  return (
    error &&
    typeof error === "object" &&
    typeof error.name === "string" &&
    error.name !== "Error"
  );
}

function updateControlState(controls = {}, override = {}) {
  const cameraActive = override.cameraActive ?? Boolean(getStream());
  const recording = override.recording ?? isRecording;
  const busy = override.busy ?? isCameraBusy;
  const disableCameraActions = busy || recording;

  setDisabled(controls.startCameraButton, cameraActive || disableCameraActions);
  setDisabled(controls.stopCameraButton, !cameraActive || disableCameraActions);
  setDisabled(controls.switchCameraButton, !cameraActive || disableCameraActions);
  setDisabled(controls.takePictureButton, !cameraActive || disableCameraActions);
  setDisabled(controls.recordVideoButton, !cameraActive || disableCameraActions);
  updateCameraStatus(controls.statusEl, { busy, cameraActive, recording });
}

function updateCameraStatus(statusEl, { busy, cameraActive, recording }) {
  if (!statusEl) {
    return;
  }

  if (recording) {
    statusEl.textContent = "Recording...";
    return;
  }

  if (busy) {
    statusEl.textContent = "Camera is working...";
    return;
  }

  statusEl.textContent = cameraActive ? "Camera is ready." : "Camera is idle.";
}

function setDisabled(element, disabled) {
  if (element) {
    element.disabled = disabled;
  }
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
