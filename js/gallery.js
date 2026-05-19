import { clearAll, listItems, removeItem, STORAGE_CHANGED_EVENT } from "./storage.js";
import { formatTimestamp } from "./utils.js";

const EMPTY_MESSAGE =
  "No captures yet. Start the camera, then take a picture or record a video.";
const galleryObjectUrls = new WeakMap();

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
      handleClearAll(clearButton, { container });
    });
  }

  render();

  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener(STORAGE_CHANGED_EVENT, render);
    return () => {
      window.removeEventListener(STORAGE_CHANGED_EVENT, render);
      revokeGalleryObjectUrls(container);
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
  revokeGalleryObjectUrls(container);
  setClearButtonState(clearButton, items);
  container.replaceChildren();

  const objectUrls = new Set();
  galleryObjectUrls.set(container, objectUrls);
  const registerObjectUrl = (url) => {
    objectUrls.add(url);
  };

  if (items.length === 0) {
    container.append(createEmptyState());
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const item of items) {
    fragment.append(createGalleryCard(item, { registerObjectUrl }));
  }

  container.append(fragment);
}

export function handleClearAll(clearButton = null, { container = null } = {}) {
  const items = listItems();
  setClearButtonState(clearButton, items);

  if (items.length === 0) {
    return false;
  }

  if (!confirmClearAll()) {
    return false;
  }

  if (container) {
    revokeGalleryObjectUrls(container);
  }

  clearAll();
  return true;
}

function createGalleryCard(item, { registerObjectUrl = noop } = {}) {
  const card = document.createElement("article");
  card.className = "gallery-card";
  card.setAttribute("aria-label", createCardLabel(item));
  const cardObjectUrls = new Set();
  const trackObjectUrl = (url) => {
    cardObjectUrls.add(url);
    registerObjectUrl(url);
  };
  const mediaResource = createMediaResource(item, trackObjectUrl);

  const media = document.createElement("div");
  media.className = "gallery-card__media";
  media.append(createMediaElement(item, mediaResource));
  const beautyBadge = createBeautyBadge(item);
  if (beautyBadge) {
    media.append(beautyBadge);
  }

  const meta = document.createElement("div");
  meta.className = "gallery-card__meta";

  const type = document.createElement("span");
  type.className = "gallery-card__type";
  type.textContent = formatTypeLabel(item.type);

  const createdAt = document.createElement("time");
  createdAt.className = "gallery-card__time";
  createdAt.dateTime = item.createdAt;
  createdAt.textContent = formatItemTimestamp(item.createdAt);

  meta.append(
    type,
    createdAt,
    createActions(item, {
      mediaResource,
      onBeforeDelete: () => {
        revokeObjectUrlSet(cardObjectUrls);
      },
    }),
  );
  card.append(media, meta);

  return card;
}

function createActions(item, { mediaResource, onBeforeDelete = noop } = {}) {
  const actions = document.createElement("div");
  actions.className = "gallery-card__actions";

  const download = document.createElement("a");
  download.className = "gallery-card__download";
  download.setAttribute("aria-label", `Download ${formatTypeLabel(item.type)}`);
  download.download = createDownloadFilename(item, mediaResource);
  download.href = mediaResource?.url || item.data;
  download.textContent = "Download";

  const remove = document.createElement("button");
  remove.className = "gallery-card__delete";
  remove.setAttribute("aria-label", `Delete ${formatTypeLabel(item.type)}`);
  remove.type = "button";
  remove.textContent = "Delete";
  remove.addEventListener("click", () => {
    if (confirmDelete()) {
      onBeforeDelete();
      removeItem(item.id);
    }
  });

  actions.append(download, remove);
  return actions;
}

function createMediaElement(item, mediaResource = createMediaResource(item)) {
  if (item.type === "picture") {
    const image = document.createElement("img");
    image.alt = "Captured picture";
    image.decoding = "async";
    image.loading = "lazy";
    image.src = mediaResource.url;
    return image;
  }

  if (item.type === "video") {
    const video = document.createElement("video");
    video.controls = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = mediaResource.url;
    video.setAttribute("aria-label", "Captured video");
    return video;
  }

  const unsupported = document.createElement("div");
  unsupported.className = "gallery-card__unsupported";
  unsupported.textContent = "Unsupported capture";
  return unsupported;
}

function createMediaResource(item, registerObjectUrl = noop) {
  if (item.type !== "video") {
    return {
      mimeType: getDataUrlMimeType(item.data),
      url: item.data,
    };
  }

  const blobResource = createVideoBlobResource(item.data);
  if (!blobResource) {
    return {
      mimeType: getDataUrlMimeType(item.data),
      url: item.data,
    };
  }

  registerObjectUrl(blobResource.url);
  return blobResource;
}

function createVideoBlobResource(dataUrl) {
  const parsedDataUrl = parseBase64DataUrl(dataUrl);
  if (!parsedDataUrl || !canCreateObjectUrl()) {
    return null;
  }

  try {
    const blob = new Blob([parsedDataUrl.bytes], { type: parsedDataUrl.mimeType });
    return {
      mimeType: parsedDataUrl.mimeType,
      url: URL.createObjectURL(blob),
    };
  } catch {
    return null;
  }
}

function parseBase64DataUrl(dataUrl) {
  if (typeof dataUrl !== "string") {
    return null;
  }

  const match = /^data:([^,]+),(.*)$/s.exec(dataUrl);
  if (!match) {
    return null;
  }

  const metadata = match[1];
  const metadataParts = metadata.split(";").map((part) => part.trim());
  if (!metadataParts.some((part) => part.toLowerCase() === "base64")) {
    return null;
  }

  const mimeType = metadataParts[0]?.toLowerCase();
  if (!mimeType) {
    return null;
  }

  try {
    if (typeof globalThis.atob !== "function") {
      return null;
    }

    const binaryString = globalThis.atob(match[2].replace(/\s/g, ""));
    const bytes = new Uint8Array(binaryString.length);
    for (let index = 0; index < binaryString.length; index += 1) {
      bytes[index] = binaryString.charCodeAt(index);
    }

    return { bytes, mimeType };
  } catch {
    return null;
  }
}

function createBeautyBadge(item) {
  const beautyLevel = normalizeBeautyLevel(item.beautyLevel);

  if (beautyLevel <= 0) {
    return null;
  }

  const badge = document.createElement("span");
  badge.className = "gallery-card__beauty-badge";
  badge.textContent = `Beauty ${beautyLevel}`;
  return badge;
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

function createCardLabel(item) {
  return `${formatTypeLabel(item.type)} captured ${formatItemTimestamp(item.createdAt)}`;
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

function createDownloadFilename(item, mediaResource = null) {
  return `snapvault-${item.id}.${getFileExtension(item, mediaResource)}`;
}

function getFileExtension(item, mediaResource = null) {
  const mimeType = normalizeMimeType(
    mediaResource?.mimeType || getDataUrlMimeType(item.data),
  );

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

function normalizeMimeType(mimeType) {
  return String(mimeType || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
}

function canCreateObjectUrl() {
  return (
    typeof Blob === "function" &&
    typeof URL !== "undefined" &&
    typeof URL.createObjectURL === "function"
  );
}

function revokeGalleryObjectUrls(container) {
  const objectUrls = galleryObjectUrls.get(container);
  if (!objectUrls) {
    return;
  }

  revokeObjectUrlSet(objectUrls);
  galleryObjectUrls.delete(container);
}

function revokeObjectUrlSet(objectUrls) {
  for (const objectUrl of objectUrls) {
    try {
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Ignore revoke failures so cleanup never blocks gallery updates.
    }
  }

  objectUrls.clear();
}

function normalizeBeautyLevel(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(numberValue)));
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
