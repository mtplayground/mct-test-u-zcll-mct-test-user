import { afterEach, describe, expect, it, vi } from "vitest";

import { CAMERA_ERROR_EVENT, initStatusEvents, showStatus } from "../js/ui.js";
import { STORAGE_QUOTA_EXCEEDED_EVENT } from "../js/storage.js";

describe("status UI", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("shows a status banner and auto-dismisses success after 3s", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<div id="status-root" class="status-stack"></div>`;

    showStatus("success", "Saved.");

    expect(document.querySelector(".status-banner--success")?.textContent).toBe(
      "Saved.",
    );
    expect(document.querySelector(".status-banner")?.getAttribute("role")).toBe(
      "status",
    );

    await vi.advanceTimersByTimeAsync(2_999);
    expect(document.querySelector(".status-banner")).not.toBeNull();

    await vi.advanceTimersByTimeAsync(1);
    expect(document.querySelector(".status-banner")).toBeNull();
  });

  it("keeps error banners visible until another status replaces them", () => {
    document.body.innerHTML = `<div id="status-root" class="status-stack"></div>`;

    showStatus("error", "Camera failed.");

    expect(document.querySelector(".status-banner--error")?.textContent).toBe(
      "Camera failed.",
    );
    expect(document.querySelector(".status-banner")?.getAttribute("role")).toBe(
      "alert",
    );
  });

  it("shows a quota-exceeded banner from storage events", () => {
    document.body.innerHTML = `<div id="status-root" class="status-stack"></div>`;
    const unsubscribe = initStatusEvents(document);

    window.dispatchEvent(new CustomEvent(STORAGE_QUOTA_EXCEEDED_EVENT));

    expect(document.querySelector(".status-banner--error")?.textContent).toBe(
      "Storage is full. Delete older captures, then try saving again.",
    );

    unsubscribe();
  });

  it("shows a friendly camera error banner from camera error events", () => {
    document.body.innerHTML = `<div id="status-root" class="status-stack"></div>`;
    const unsubscribe = initStatusEvents(document);

    window.dispatchEvent(
      new CustomEvent(CAMERA_ERROR_EVENT, {
        detail: {
          error: {
            name: "NotAllowedError",
          },
        },
      }),
    );

    expect(document.querySelector(".status-banner--error")?.textContent).toContain(
      "Camera permission was blocked",
    );

    unsubscribe();
  });
});
