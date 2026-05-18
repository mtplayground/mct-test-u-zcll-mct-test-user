import { getMediaDevicesErrorMessage } from "./errors.js";
import { STORAGE_QUOTA_EXCEEDED_EVENT } from "./storage.js";

export const CAMERA_ERROR_EVENT = "camera:error";

const SUCCESS_DISMISS_MS = 3000;
const STATUS_TYPES = new Set(["error", "info", "success", "warning"]);
let dismissTimer = null;

export function initStatusEvents(root = document) {
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
    return noop;
  }

  const handleQuotaExceeded = () => {
    showStatus(
      "error",
      "Storage is full. Delete older captures, then try saving again.",
      { root },
    );
  };
  const handleCameraError = (event) => {
    showStatus("error", getCameraErrorMessage(event), { root });
  };

  window.addEventListener(STORAGE_QUOTA_EXCEEDED_EVENT, handleQuotaExceeded);
  window.addEventListener(CAMERA_ERROR_EVENT, handleCameraError);

  return () => {
    window.removeEventListener(STORAGE_QUOTA_EXCEEDED_EVENT, handleQuotaExceeded);
    window.removeEventListener(CAMERA_ERROR_EVENT, handleCameraError);
  };
}

export function showStatus(type, message, { root = document, autoDismiss } = {}) {
  const statusType = normalizeStatusType(type);
  const statusMessage = normalizeMessage(message);
  const container = getStatusContainer(root);
  const banner = document.createElement("div");

  clearDismissTimer();
  banner.className = `status-banner status-banner--${statusType} toast toast--${statusType}`;
  banner.setAttribute("role", statusType === "error" ? "alert" : "status");
  banner.textContent = statusMessage;
  container.replaceChildren(banner);

  const shouldAutoDismiss =
    autoDismiss === undefined ? statusType === "success" : Boolean(autoDismiss);
  if (shouldAutoDismiss) {
    dismissTimer = setTimeout(() => {
      banner.remove();
      dismissTimer = null;
    }, SUCCESS_DISMISS_MS);
  }

  return banner;
}

function getStatusContainer(root) {
  const documentRef = root.ownerDocument || root;
  let container = root.querySelector?.("#status-root");

  if (!container) {
    container = documentRef.createElement("div");
    container.id = "status-root";
    container.className = "status-stack";
    container.setAttribute("aria-live", "polite");
    documentRef.body.prepend(container);
  }

  return container;
}

function getCameraErrorMessage(event) {
  const detail = event?.detail;

  if (typeof detail?.message === "string" && detail.message.trim() !== "") {
    return detail.message;
  }

  return getMediaDevicesErrorMessage(detail?.error || detail);
}

function normalizeStatusType(type) {
  return STATUS_TYPES.has(type) ? type : "info";
}

function normalizeMessage(message) {
  if (typeof message === "string" && message.trim() !== "") {
    return message;
  }

  return "Something changed.";
}

function clearDismissTimer() {
  if (dismissTimer !== null) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
}

function noop() {
  return undefined;
}
