import { afterEach, describe, expect, it, vi } from "vitest";

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

  it("resets the level to 0 and persists the reset value", async () => {
    localStorage.setItem(BEAUTY_LEVEL_STORAGE_KEY, "88");
    document.body.innerHTML = createBeautyMarkup();
    mockAppModules();

    await import("../js/app.js");

    document.querySelector("#reset-beauty-level").click();

    expect(document.querySelector("#beauty-level").value).toBe("0");
    expect(document.querySelector("#beauty-level-value").textContent).toBe("0");
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

function mockAppModules() {
  vi.doMock("../js/camera.js", () => ({
    getStream: () => null,
    startCamera: vi.fn(),
    stopCamera: vi.fn(),
    switchCamera: vi.fn(),
  }));
  vi.doMock("../js/capture.js", () => ({
    capturePicture: vi.fn(),
    recordVideo: vi.fn(),
  }));
  vi.doMock("../js/storage.js", () => ({
    addItem: vi.fn(),
    STORAGE_QUOTA_EXCEEDED_EVENT: "storage:quota-exceeded",
  }));
  vi.doMock("../js/utils.js", () => ({
    newId: () => "capture-id",
  }));
}

function createBeautyMarkup() {
  return `
    <div id="status-root" class="status-stack"></div>
    <div class="beauty-control" aria-labelledby="beauty-level-label">
      <label id="beauty-level-label" for="beauty-level">Beauty</label>
      <output id="beauty-level-value" for="beauty-level">0</output>
      <input id="beauty-level" type="range" min="0" max="100" step="1" value="0" />
      <button id="reset-beauty-level" type="button">Reset</button>
    </div>
  `;
}
