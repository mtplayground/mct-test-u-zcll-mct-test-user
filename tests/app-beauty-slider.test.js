import { afterEach, describe, expect, it, vi } from "vitest";

import { filterSpec } from "../js/filter.js";

const BEAUTY_LEVEL_STORAGE_KEY = "snapvault:v2:beauty-level";

describe("beauty slider UI wiring", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.doUnmock("../js/camera.js");
    vi.doUnmock("../js/capture.js");
    vi.doUnmock("../js/storage.js");
    vi.doUnmock("../js/utils.js");
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("restores the last-used beauty level on load", async () => {
    localStorage.setItem(BEAUTY_LEVEL_STORAGE_KEY, "42");
    document.body.innerHTML = createBeautyMarkup();
    mockAppModules();

    await import("../js/app.js");

    expect(document.querySelector("#beauty-level").value).toBe("42");
    expect(document.querySelector("#beauty-level").getAttribute("aria-valuetext")).toBe(
      "42",
    );
    expect(document.querySelector("#beauty-level-value").textContent).toBe("42");
  });

  it("updates the readout and persists slider input", async () => {
    document.body.innerHTML = createBeautyMarkup();
    mockAppModules();

    await import("../js/app.js");

    const slider = document.querySelector("#beauty-level");
    slider.value = "67";
    slider.dispatchEvent(new window.Event("input", { bubbles: true }));

    expect(document.querySelector("#beauty-level-value").textContent).toBe("67");
    expect(slider.getAttribute("aria-valuetext")).toBe("67");
    expect(localStorage.getItem(BEAUTY_LEVEL_STORAGE_KEY)).toBe("67");
  });

  it("passes the active beauty level when taking a picture", async () => {
    const stream = { getTracks: vi.fn(() => []) };
    const { addItem, capturePicture } = mockAppModules({ stream });
    document.body.innerHTML = `${createBeautyMarkup({ includePreview: true })}
      <button id="take-picture" type="button">Take Picture</button>`;

    await import("../js/app.js");

    const slider = document.querySelector("#beauty-level");
    slider.value = "46";
    slider.dispatchEvent(new window.Event("input", { bubbles: true }));
    document.querySelector("#take-picture").click();

    const videoEl = document.querySelector("#camera-preview");
    expect(capturePicture).toHaveBeenCalledWith(videoEl, { beautyLevel: 46 });
    expect(addItem).toHaveBeenCalledWith({
      createdAt: expect.any(String),
      data: "data:image/jpeg;base64,captured",
      id: "capture-id",
      type: "picture",
    });
  });

  it("defaults picture capture to level 0 when the slider is missing", async () => {
    const stream = { getTracks: vi.fn(() => []) };
    const { capturePicture } = mockAppModules({ stream });
    document.body.innerHTML = `
      <video id="camera-preview"></video>
      <button id="take-picture" type="button">Take Picture</button>
    `;

    await import("../js/app.js");

    const videoEl = document.querySelector("#camera-preview");
    document.querySelector("#take-picture").click();

    expect(capturePicture).toHaveBeenCalledWith(videoEl, { beautyLevel: 0 });
  });

  it("applies the beauty filter to the live preview as the slider changes", async () => {
    document.body.innerHTML = createBeautyMarkup({ includePreview: true });
    mockAppModules();

    await import("../js/app.js");

    const slider = document.querySelector("#beauty-level");
    const preview = document.querySelector("#camera-preview");

    expect(preview.style.filter).toBe("none");

    slider.value = "55";
    slider.dispatchEvent(new window.Event("input", { bubbles: true }));

    expect(preview.style.filter).toBe(filterSpec(55).cssFilter);
    expect(preview.style.filter).not.toBe("none");

    slider.value = "0";
    slider.dispatchEvent(new window.Event("input", { bubbles: true }));

    expect(preview.style.filter).toBe("none");
  });

  it("resets the level to 0 and persists the reset value", async () => {
    localStorage.setItem(BEAUTY_LEVEL_STORAGE_KEY, "88");
    document.body.innerHTML = createBeautyMarkup({ includePreview: true });
    mockAppModules();

    await import("../js/app.js");

    expect(document.querySelector("#camera-preview").style.filter).toBe(
      filterSpec(88).cssFilter,
    );

    document.querySelector("#reset-beauty-level").click();

    expect(document.querySelector("#beauty-level").value).toBe("0");
    expect(document.querySelector("#beauty-level-value").textContent).toBe("0");
    expect(document.querySelector("#camera-preview").style.filter).toBe("none");
    expect(localStorage.getItem(BEAUTY_LEVEL_STORAGE_KEY)).toBe("0");
  });

  it("normalizes stored and input values into the slider range", async () => {
    localStorage.setItem(BEAUTY_LEVEL_STORAGE_KEY, "140");
    document.body.innerHTML = createBeautyMarkup();
    mockAppModules();

    await import("../js/app.js");

    const slider = document.querySelector("#beauty-level");
    expect(slider.value).toBe("100");

    slider.value = "-1";
    slider.dispatchEvent(new window.Event("input", { bubbles: true }));

    expect(slider.value).toBe("0");
    expect(localStorage.getItem(BEAUTY_LEVEL_STORAGE_KEY)).toBe("0");
  });
});

function mockAppModules({ stream = null } = {}) {
  const addItem = vi.fn();
  const capturePicture = vi.fn(() => "data:image/jpeg;base64,captured");

  vi.doMock("../js/camera.js", () => ({
    getStream: () => stream,
    startCamera: vi.fn(),
    stopCamera: vi.fn(),
    switchCamera: vi.fn(),
  }));
  vi.doMock("../js/capture.js", () => ({
    capturePicture,
    recordVideo: vi.fn(),
  }));
  vi.doMock("../js/storage.js", () => ({
    addItem,
    STORAGE_QUOTA_EXCEEDED_EVENT: "storage:quota-exceeded",
  }));
  vi.doMock("../js/utils.js", () => ({
    newId: () => "capture-id",
  }));

  return { addItem, capturePicture };
}

function createBeautyMarkup({ includePreview = false } = {}) {
  return `
    <div id="status-root" class="status-stack"></div>
    ${includePreview ? '<video id="camera-preview"></video>' : ""}
    <div class="beauty-control" aria-labelledby="beauty-level-label">
      <label id="beauty-level-label" for="beauty-level">Beauty</label>
      <output id="beauty-level-value" for="beauty-level">0</output>
      <input id="beauty-level" type="range" min="0" max="100" step="1" value="0" />
      <button id="reset-beauty-level" type="button">Reset</button>
    </div>
  `;
}
