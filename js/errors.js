export const UNKNOWN_MEDIA_ERROR = "UnknownError";
export const MISSING_MEDIA_DEVICES_ERROR = "MissingMediaDevicesError";
export const MISSING_GET_USER_MEDIA_ERROR = "MissingGetUserMediaError";

export const MEDIA_DEVICE_ERROR_MESSAGES = Object.freeze({
  [MISSING_GET_USER_MEDIA_ERROR]:
    "This browser does not support camera capture. Try a current version of Chrome, Edge, Firefox, or Safari.",
  [MISSING_MEDIA_DEVICES_ERROR]:
    "This browser does not support camera capture. Try a current version of Chrome, Edge, Firefox, or Safari.",
  NotAllowedError:
    "Camera permission was blocked. Allow camera and microphone access, then try again.",
  NotFoundError: "No camera or microphone was found on this device.",
  NotReadableError:
    "The camera or microphone is already in use by another app or browser tab.",
  OverconstrainedError: "The requested camera setting is not available on this device.",
  SecurityError:
    "Camera access is blocked because this page is not in a secure context. Use HTTPS or localhost.",
  [UNKNOWN_MEDIA_ERROR]:
    "Camera access failed. Check browser permissions and device availability, then try again.",
});

export function getMediaDevicesErrorMessage(error) {
  const errorName = getMediaDevicesErrorName(error);
  return (
    MEDIA_DEVICE_ERROR_MESSAGES[errorName] ||
    MEDIA_DEVICE_ERROR_MESSAGES[UNKNOWN_MEDIA_ERROR]
  );
}

export function getMediaDevicesErrorName(error) {
  if (typeof error === "string" && error.trim() !== "") {
    return error;
  }

  if (isRecord(error) && typeof error.name === "string" && error.name.trim() !== "") {
    return error.name;
  }

  return UNKNOWN_MEDIA_ERROR;
}

export function createMissingMediaDevicesError() {
  const error = new Error(MEDIA_DEVICE_ERROR_MESSAGES[MISSING_MEDIA_DEVICES_ERROR]);
  error.name = MISSING_MEDIA_DEVICES_ERROR;
  return error;
}

export function createMissingGetUserMediaError() {
  const error = new Error(MEDIA_DEVICE_ERROR_MESSAGES[MISSING_GET_USER_MEDIA_ERROR]);
  error.name = MISSING_GET_USER_MEDIA_ERROR;
  return error;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
