import { capturePicture } from "./capture.js";
import { addItem } from "./storage.js";
import { newId } from "./utils.js";

const TOAST_DURATION_MS = 4000;

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
