import { describe, expect, it } from "vitest";

import {
  createMissingGetUserMediaError,
  createMissingMediaDevicesError,
  getMediaDevicesErrorMessage,
  MISSING_GET_USER_MEDIA_ERROR,
  MISSING_MEDIA_DEVICES_ERROR,
} from "../js/errors.js";

describe("getMediaDevicesErrorMessage", () => {
  it.each([
    [
      "NotAllowedError",
      "Camera permission was blocked. Allow camera and microphone access, then try again.",
    ],
    ["NotFoundError", "No camera or microphone was found on this device."],
    [
      "NotReadableError",
      "The camera or microphone is already in use by another app or browser tab.",
    ],
    [
      "OverconstrainedError",
      "The requested camera setting is not available on this device.",
    ],
    [
      "SecurityError",
      "Camera access is blocked because this page is not in a secure context. Use HTTPS or localhost.",
    ],
  ])("maps %s to a friendly message", (name, message) => {
    expect(getMediaDevicesErrorMessage(new DOMException("", name))).toBe(message);
  });

  it("maps missing MediaDevices support to a friendly message", () => {
    expect(getMediaDevicesErrorMessage(MISSING_MEDIA_DEVICES_ERROR)).toContain(
      "does not support camera capture",
    );
    expect(getMediaDevicesErrorMessage(MISSING_GET_USER_MEDIA_ERROR)).toContain(
      "does not support camera capture",
    );
  });

  it("maps unknown errors to a fallback message", () => {
    expect(getMediaDevicesErrorMessage(new Error("Unexpected failure"))).toBe(
      "Camera access failed. Check browser permissions and device availability, then try again.",
    );
  });
});

describe("missing API error factories", () => {
  it("creates named errors for missing MediaDevices APIs", () => {
    expect(createMissingMediaDevicesError()).toMatchObject({
      name: MISSING_MEDIA_DEVICES_ERROR,
    });
    expect(createMissingGetUserMediaError()).toMatchObject({
      name: MISSING_GET_USER_MEDIA_ERROR,
    });
  });
});
