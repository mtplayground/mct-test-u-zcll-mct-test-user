import { afterEach, describe, expect, it, vi } from "vitest";

import { handleClearAll, initGallery, renderGallery } from "../js/gallery.js";
import { addItem, listItems } from "../js/storage.js";

describe("gallery rendering", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    delete window.confirm;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders picture and video cards with media, type labels, and timestamps", () => {
    const { createObjectURL } = stubObjectUrls(["blob:video-1"]);
    const container = document.createElement("div");
    container.id = "gallery";
    const videoDataUrl = "data:video/webm;base64,dmllbw==";

    renderGallery(container, [
      {
        beautyLevel: 40,
        createdAt: "2026-05-18T12:00:00.000Z",
        data: "data:image/jpeg;base64,picture",
        id: "picture-1",
        type: "picture",
      },
      {
        beautyLevel: 0,
        createdAt: "2026-05-18T12:05:00.000Z",
        data: videoDataUrl,
        duration: 15,
        id: "video-1",
        type: "video",
      },
    ]);

    const cards = container.querySelectorAll(".gallery-card");
    expect(cards).toHaveLength(2);
    expect(cards[0].getAttribute("aria-label")).toContain("Picture captured");
    expect(cards[0].querySelector("img")?.src).toBe("data:image/jpeg;base64,picture");
    expect(cards[0].querySelector(".gallery-card__type")?.textContent).toBe("Picture");
    expect(cards[0].querySelector("time")?.dateTime).toBe("2026-05-18T12:00:00.000Z");
    expect(cards[0].querySelector("a")?.download).toBe("snapvault-picture-1.jpg");
    expect(cards[0].querySelector("a")?.getAttribute("aria-label")).toBe(
      "Download Picture",
    );
    expect(cards[0].querySelector("a")?.href).toBe("data:image/jpeg;base64,picture");
    expect(cards[0].querySelector(".gallery-card__beauty-badge")?.textContent).toBe(
      "Beauty 40",
    );
    expect(cards[0].querySelector("button")?.getAttribute("aria-label")).toBe(
      "Delete Picture",
    );

    const video = cards[1].querySelector("video");
    expect(video?.controls).toBe(true);
    expect(video?.src).toBe("blob:video-1");
    expect(video?.src.startsWith("blob:")).toBe(true);
    expect(video?.src.startsWith("data:")).toBe(false);
    expect(cards[1].querySelector(".gallery-card__type")?.textContent).toBe("Video");
    expect(cards[1].querySelector("time")?.dateTime).toBe("2026-05-18T12:05:00.000Z");
    expect(cards[1].querySelector("a")?.download).toBe("snapvault-video-1.webm");
    expect(cards[1].querySelector("a")?.getAttribute("aria-label")).toBe(
      "Download Video",
    );
    expect(cards[1].querySelector("a")?.href).toBe("blob:video-1");
    expect(cards[1].querySelector("a")?.href.startsWith("data:")).toBe(false);
    expect(cards[1].querySelector(".gallery-card__beauty-badge")).toBeNull();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const createdBlob = createObjectURL.mock.calls[0][0];
    expect(createdBlob).toBeInstanceOf(Blob);
    expect(createdBlob.type).toBe("video/webm");
  });

  it("omits the beauty badge for missing, invalid, and zero levels", () => {
    const container = document.createElement("div");

    renderGallery(container, [
      {
        createdAt: "2026-05-18T12:00:00.000Z",
        data: "data:image/jpeg;base64,picture",
        id: "missing-level",
        type: "picture",
      },
      {
        beautyLevel: Number.NaN,
        createdAt: "2026-05-18T12:01:00.000Z",
        data: "data:image/jpeg;base64,picture",
        id: "invalid-level",
        type: "picture",
      },
      {
        beautyLevel: 0,
        createdAt: "2026-05-18T12:02:00.000Z",
        data: "data:image/jpeg;base64,picture",
        id: "zero-level",
        type: "picture",
      },
    ]);

    expect(container.querySelectorAll(".gallery-card__beauty-badge")).toHaveLength(0);
  });

  it("renders an empty state when storage has no items", () => {
    const container = document.createElement("div");
    renderGallery(container, []);

    expect(container.querySelector(".empty-state")?.textContent).toBe(
      "No captures yet. Start the camera, then take a picture or record a video.",
    );
    expect(container.querySelectorAll(".gallery-card")).toHaveLength(0);
  });

  it("subscribes to storage changes and re-renders from storage", () => {
    document.body.innerHTML = `
      <button id="clear-gallery" type="button">Clear All</button>
      <div id="gallery"></div>
    `;

    const unsubscribe = initGallery(document);
    expect(document.querySelector(".empty-state")).not.toBeNull();
    expect(document.querySelector("#clear-gallery").disabled).toBe(true);

    addItem({
      createdAt: "2026-05-18T12:00:00.000Z",
      data: "data:image/jpeg;base64,picture",
      id: "picture-1",
      type: "picture",
    });

    expect(document.querySelectorAll(".gallery-card")).toHaveLength(1);
    expect(document.querySelector("img")?.src).toBe("data:image/jpeg;base64,picture");
    expect(document.querySelector("#clear-gallery").disabled).toBe(false);

    unsubscribe();

    addItem({
      createdAt: "2026-05-18T12:01:00.000Z",
      data: "data:image/jpeg;base64,picture-2",
      id: "picture-2",
      type: "picture",
    });

    expect(document.querySelectorAll(".gallery-card")).toHaveLength(1);
  });

  it("revokes a video blob URL before re-rendering the gallery", () => {
    const { createObjectURL, revokeObjectURL } = stubObjectUrls([
      "blob:video-first",
      "blob:video-second",
    ]);
    const container = document.createElement("div");
    const item = {
      createdAt: "2026-05-18T12:00:00.000Z",
      data: "data:video/mp4;base64,dmllbw==",
      id: "video-1",
      type: "video",
    };

    renderGallery(container, [item]);

    expect(container.querySelector("video")?.src).toBe("blob:video-first");
    expect(container.querySelector("a")?.href).toBe("blob:video-first");
    expect(createObjectURL).toHaveBeenCalledTimes(1);

    renderGallery(container, [item]);

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:video-first");
    expect(container.querySelector("video")?.src).toBe("blob:video-second");
    expect(container.querySelector("a")?.href).toBe("blob:video-second");
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(createObjectURL.mock.calls[1][0]).toBeInstanceOf(Blob);
    expect(createObjectURL.mock.calls[1][0].type).toBe("video/mp4");
  });

  it("clears all captures after confirmation and disables the header button", () => {
    document.body.innerHTML = `
      <button id="clear-gallery" type="button">Clear All</button>
      <div id="gallery"></div>
    `;
    window.confirm = vi.fn(() => true);

    initGallery(document);
    addItem({
      createdAt: "2026-05-18T12:00:00.000Z",
      data: "data:image/jpeg;base64,picture",
      id: "picture-1",
      type: "picture",
    });
    addItem({
      createdAt: "2026-05-18T12:01:00.000Z",
      data: "data:video/webm;base64,video",
      id: "video-1",
      type: "video",
    });

    document.querySelector("#clear-gallery").click();

    expect(window.confirm).toHaveBeenCalledWith("Delete all captures?");
    expect(listItems()).toEqual([]);
    expect(document.querySelector("#clear-gallery").disabled).toBe(true);
    expect(document.querySelector(".empty-state")?.textContent).toBe(
      "No captures yet. Start the camera, then take a picture or record a video.",
    );
  });

  it("keeps all captures when clear all is cancelled", () => {
    document.body.innerHTML = `
      <button id="clear-gallery" type="button">Clear All</button>
      <div id="gallery"></div>
    `;
    window.confirm = vi.fn(() => false);

    initGallery(document);
    addItem({
      createdAt: "2026-05-18T12:00:00.000Z",
      data: "data:image/jpeg;base64,picture",
      id: "picture-1",
      type: "picture",
    });

    expect(handleClearAll(document.querySelector("#clear-gallery"))).toBe(false);

    expect(listItems()).toHaveLength(1);
    expect(document.querySelector("#clear-gallery").disabled).toBe(false);
    expect(document.querySelectorAll(".gallery-card")).toHaveLength(1);
  });

  it("deletes a capture after confirmation and re-renders", () => {
    document.body.innerHTML = `<div id="gallery"></div>`;
    window.confirm = vi.fn(() => true);

    initGallery(document);
    addItem({
      createdAt: "2026-05-18T12:00:00.000Z",
      data: "data:image/jpeg;base64,picture",
      id: "picture-1",
      type: "picture",
    });

    document.querySelector(".gallery-card__delete").click();

    expect(listItems()).toEqual([]);
    expect(document.querySelector(".empty-state")?.textContent).toBe(
      "No captures yet. Start the camera, then take a picture or record a video.",
    );
  });

  it("revokes a video blob URL when deleting a video capture", () => {
    const { revokeObjectURL } = stubObjectUrls();
    document.body.innerHTML = `<div id="gallery"></div>`;
    window.confirm = vi.fn(() => true);

    initGallery(document);
    addItem({
      createdAt: "2026-05-18T12:00:00.000Z",
      data: "data:video/webm;base64,dmllbw==",
      id: "video-1",
      type: "video",
    });

    const videoUrl = document.querySelector("video")?.src;
    expect(videoUrl?.startsWith("blob:")).toBe(true);

    document.querySelector(".gallery-card__delete").click();

    expect(revokeObjectURL).toHaveBeenCalledWith(videoUrl);
    expect(listItems()).toEqual([]);
    expect(document.querySelector(".empty-state")?.textContent).toBe(
      "No captures yet. Start the camera, then take a picture or record a video.",
    );
  });

  it("keeps a capture when deletion is cancelled", () => {
    document.body.innerHTML = `<div id="gallery"></div>`;
    window.confirm = vi.fn(() => false);

    initGallery(document);
    addItem({
      createdAt: "2026-05-18T12:00:00.000Z",
      data: "data:image/png;base64,picture",
      id: "picture-1",
      type: "picture",
    });

    document.querySelector(".gallery-card__delete").click();

    expect(listItems()).toHaveLength(1);
    expect(document.querySelectorAll(".gallery-card")).toHaveLength(1);
    expect(document.querySelector("a")?.download).toBe("snapvault-picture-1.png");
  });
});

function stubObjectUrls(urls = []) {
  const queue = [...urls];
  let generatedUrlIndex = 0;
  const createObjectURL = vi.fn(
    () => queue.shift() || `blob:generated-video-${(generatedUrlIndex += 1)}`,
  );
  const revokeObjectURL = vi.fn();
  const URLWithObjectUrls = Object.create(globalThis.URL);

  Object.defineProperty(URLWithObjectUrls, "createObjectURL", {
    configurable: true,
    value: createObjectURL,
  });
  Object.defineProperty(URLWithObjectUrls, "revokeObjectURL", {
    configurable: true,
    value: revokeObjectURL,
  });
  vi.stubGlobal("URL", URLWithObjectUrls);

  return { createObjectURL, revokeObjectURL };
}
