import { clearAll, listItems, removeItem, STORAGE_CHANGED_EVENT } from "./storage.js";
import { formatTimestamp } from "./utils.js";

const EMPTY_MESSAGE =
  "No captures yet. Start the camera, then take a picture or record a video.";

export function initGallery(root = document) {
  const container = root.querySelector("#gallery");
  const clearButton = root.querySelector("#clear-gallery");

  if (!container) {
    return noop;
  }

  const render = () => {
    renderGallery(container, listItems(), { clearButton });
  };

  if (clearButton) {
    clearButton.addEventListener("click", () => {
      handleClearAll(clearButton);
    });
  }

  render();

  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener(STORAGE_CHANGED_EVENT, render);
    return () => {
      window.removeEventListener(STORAGE_CHANGED_EVENT, render);
    };
  }

  return noop;
}

export function renderGallery(
  container,
  items = listItems(),
  { clearButton = null } = {},
) {
  assertContainer(container);
  setClearButtonState(clearButton, items);
  container.replaceChildren();

  if (items.length === 0) {
    container.append(createEmptyState());
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const item of items) {
    fragment.append(createGalleryCard(item));
  }

  container.append(fragment);
}

export function handleClearAll(clearButton = null) {
  const items = listItems();
  setClearButtonState(clearButton, items);

  if (items.length === 0) {
    return false;
  }

  if (!confirmClearAll()) {
    return false;
  }

  clearAll();
  return true;
}

function createGalleryCard(item) {
  const card = document.createElement("article");
  card.className = "gallery-card";

  const media = document.createElement("div");
  media.className = "gallery-card__media";
  media.append(createMediaElement(item));

  const meta = document.createElement("div");
  meta.className = "gallery-card__meta";

  const type = document.createElement("span");
  type.className = "gallery-card__type";
  type.textContent = formatTypeLabel(item.type);

  const createdAt = document.createElement("time");
  createdAt.className = "gallery-card__time";
  createdAt.dateTime = item.createdAt;
  createdAt.textContent = formatItemTimestamp(item.createdAt);

  meta.append(type, createdAt, createActions(item));
  card.append(media, meta);

  return card;
}

function createActions(item) {
  const actions = document.createElement("div");
  actions.className = "gallery-card__actions";

  const download = document.createElement("a");
  download.className = "gallery-card__download";
  download.download = createDownloadFilename(item);
  download.href = item.data;
  download.textContent = "Download";

  const remove = document.createElement("button");
  remove.className = "gallery-card__delete";
  remove.type = "button";
  remove.textContent = "Delete";
  remove.addEventListener("click", () => {
    if (confirmDelete()) {
      removeItem(item.id);
    }
  });

  actions.append(download, remove);
  return actions;
}

function createMediaElement(item) {
  if (item.type === "picture") {
    const image = document.createElement("img");
    image.alt = "Captured picture";
    image.decoding = "async";
    image.loading = "lazy";
    image.src = item.data;
    return image;
  }

  if (item.type === "video") {
    const video = document.createElement("video");
    video.controls = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = item.data;
    video.setAttribute("aria-label", "Captured video");
    return video;
  }

  const unsupported = document.createElement("div");
  unsupported.className = "gallery-card__unsupported";
  unsupported.textContent = "Unsupported capture";
  return unsupported;
}

function createEmptyState() {
  const emptyState = document.createElement("p");
  emptyState.className = "empty-state";
  emptyState.textContent = EMPTY_MESSAGE;
  return emptyState;
}

function formatTypeLabel(type) {
  if (type === "picture") {
    return "Picture";
  }

  if (type === "video") {
    return "Video";
  }

  return "Capture";
}

function formatItemTimestamp(createdAt) {
  const timestamp = Date.parse(createdAt);

  if (!Number.isFinite(timestamp)) {
    return createdAt;
  }

  try {
    return formatTimestamp(timestamp);
  } catch {
    return createdAt;
  }
}

function createDownloadFilename(item) {
  return `snapvault-${item.id}.${getFileExtension(item)}`;
}

function getFileExtension(item) {
  const mimeType = getDataUrlMimeType(item.data);

  if (mimeType === "image/jpeg") {
    return "jpg";
  }

  if (mimeType === "image/png") {
    return "png";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  if (mimeType === "video/mp4") {
    return "mp4";
  }

  if (mimeType === "video/webm") {
    return "webm";
  }

  if (item.type === "picture") {
    return "jpg";
  }

  if (item.type === "video") {
    return "webm";
  }

  return "dat";
}

function getDataUrlMimeType(dataUrl) {
  const match = /^data:([^;,]+)/.exec(dataUrl);
  return match ? match[1].toLowerCase() : "";
}

function confirmDelete() {
  if (typeof window === "undefined" || typeof window.confirm !== "function") {
    return true;
  }

  return window.confirm("Delete this capture?");
}

function confirmClearAll() {
  if (typeof window === "undefined" || typeof window.confirm !== "function") {
    return true;
  }

  return window.confirm("Delete all captures?");
}

function setClearButtonState(clearButton, items) {
  if (clearButton) {
    clearButton.disabled = items.length === 0;
  }
}

function assertContainer(container) {
  if (!container || typeof container.replaceChildren !== "function") {
    throw new TypeError("renderGallery requires a container element.");
  }
}

function noop() {
  return undefined;
}
