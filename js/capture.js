const JPEG_MIME_TYPE = "image/jpeg";
const JPEG_QUALITY = 0.9;

export function capturePicture(videoEl) {
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

  context.drawImage(videoEl, 0, 0, width, height);
  return canvas.toDataURL(JPEG_MIME_TYPE, JPEG_QUALITY);
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
