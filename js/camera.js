let activeStream = null;
let activeVideoEl = null;
let activeFacingMode = null;
let activeDeviceId = null;

export async function startCamera({ videoEl, facingMode } = {}) {
  return startCameraWithVideo({
    facingMode,
    video: buildFacingModeConstraints(facingMode),
    videoEl,
  });
}

export async function switchCamera() {
  if (!activeVideoEl) {
    throw new Error("Cannot switch camera before a camera has been started.");
  }

  const videoEl = activeVideoEl;
  const previousDeviceId = activeDeviceId || getStreamDeviceId(activeStream);
  const nextFacingMode = activeFacingMode === "user" ? "environment" : "user";
  const nextStream = await startCamera({ videoEl, facingMode: nextFacingMode });
  const nextDeviceId = getStreamDeviceId(nextStream);

  if (previousDeviceId && nextDeviceId === previousDeviceId) {
    const fallbackStream = await startCameraWithNextDevice({
      facingMode: nextFacingMode,
      previousDeviceId,
      videoEl,
    });

    return fallbackStream || nextStream;
  }

  return nextStream;
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
  activeFacingMode = null;
  activeDeviceId = null;
}

export function getStream() {
  return activeStream;
}

async function startCameraWithVideo({ videoEl, video, facingMode = null }) {
  assertVideoElement(videoEl);
  assertMediaDevicesAvailable();

  const constraints = {
    audio: true,
    video,
  };

  stopCamera();

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  activeStream = stream;
  activeVideoEl = videoEl;
  activeFacingMode = facingMode;
  activeDeviceId = getStreamDeviceId(stream);
  activeVideoEl.srcObject = stream;

  return stream;
}

async function startCameraWithNextDevice({ videoEl, previousDeviceId, facingMode }) {
  const nextDevice = await getNextVideoInput(previousDeviceId);

  if (!nextDevice) {
    return null;
  }

  return startCameraWithVideo({
    facingMode,
    video: {
      deviceId: {
        exact: nextDevice.deviceId,
      },
    },
    videoEl,
  });
}

async function getNextVideoInput(previousDeviceId) {
  if (typeof navigator.mediaDevices.enumerateDevices !== "function") {
    return null;
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoInputs = devices.filter(
    (device) => device.kind === "videoinput" && device.deviceId,
  );

  if (videoInputs.length < 2) {
    return null;
  }

  const currentIndex = videoInputs.findIndex(
    (device) => device.deviceId === previousDeviceId,
  );

  if (currentIndex === -1) {
    return videoInputs.find((device) => device.deviceId !== previousDeviceId) || null;
  }

  return videoInputs[(currentIndex + 1) % videoInputs.length];
}

function buildFacingModeConstraints(facingMode) {
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

function getStreamDeviceId(stream) {
  if (!stream) {
    return null;
  }

  const videoTrack = getVideoTracks(stream)[0];
  const settings =
    videoTrack && typeof videoTrack.getSettings === "function"
      ? videoTrack.getSettings()
      : null;

  return typeof settings?.deviceId === "string" && settings.deviceId
    ? settings.deviceId
    : null;
}

function getVideoTracks(stream) {
  if (typeof stream.getVideoTracks === "function") {
    return stream.getVideoTracks();
  }

  if (typeof stream.getTracks !== "function") {
    return [];
  }

  return stream.getTracks().filter((track) => track.kind === "video");
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
