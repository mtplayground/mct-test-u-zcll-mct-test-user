let activeStream = null;
let activeVideoEl = null;

export async function startCamera({ videoEl, facingMode } = {}) {
  assertVideoElement(videoEl);
  assertMediaDevicesAvailable();

  const constraints = {
    audio: true,
    video: buildVideoConstraints(facingMode),
  };

  stopCamera();

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  activeStream = stream;
  activeVideoEl = videoEl;
  activeVideoEl.srcObject = stream;

  return stream;
}

export function stopCamera() {
  if (activeStream) {
    for (const track of activeStream.getTracks()) {
      if (typeof track.stop === "function") {
        track.stop();
      }
    }
  }

  if (activeVideoEl && activeVideoEl.srcObject === activeStream) {
    activeVideoEl.srcObject = null;
  }

  activeStream = null;
  activeVideoEl = null;
}

export function getStream() {
  return activeStream;
}

function buildVideoConstraints(facingMode) {
  if (facingMode === undefined || facingMode === null) {
    return true;
  }

  if (typeof facingMode !== "string" || facingMode.trim() === "") {
    throw new TypeError("facingMode must be a non-empty string when provided.");
  }

  return {
    facingMode,
  };
}

function assertVideoElement(videoEl) {
  if (
    typeof HTMLVideoElement === "undefined" ||
    !(videoEl instanceof HTMLVideoElement)
  ) {
    throw new TypeError("startCamera requires a videoEl HTMLVideoElement option.");
  }
}

function assertMediaDevicesAvailable() {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.mediaDevices?.getUserMedia !== "function"
  ) {
    throw new Error("Camera access is not supported in this browser.");
  }
}
