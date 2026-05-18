import { listItems, STORAGE_CHANGED_EVENT } from "./storage.js";
import { formatTimestamp } from "./utils.js";

const EMPTY_MESSAGE = "No captures yet.";

export function initGallery(root = document) {
  const container = root.querySelector("#gallery");

  if (!container) {
    return noop;
  }

  const render = () => {
    renderGallery(container);
  };

  render();

  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener(STORAGE_CHANGED_EVENT, render);
    return () => {
      window.removeEventListener(STORAGE_CHANGED_EVENT, render);
    };
  }

  return noop;
}

export function renderGallery(container, items = listItems()) {
  assertContainer(container);
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

  meta.append(type, createdAt);
  card.append(media, meta);

  return card;
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

function assertContainer(container) {
  if (!container || typeof container.replaceChildren !== "function") {
    throw new TypeError("renderGallery requires a container element.");
  }
}

function noop() {
  return undefined;
}
