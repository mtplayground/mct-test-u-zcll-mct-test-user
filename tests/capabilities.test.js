import { afterEach, describe, expect, it, vi } from "vitest";

describe("camera capabilities", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("reports supported browser capabilities when required APIs are present", async () => {
    const { capabilities } = await importCameraWith({
      getUserMedia: async () => ({}),
      isSecureContext: true,
      mediaRecorder: function MediaRecorder() {},
    });

    expect(capabilities()).toMatchObject({
      canRecordVideo: true,
      canUseCamera: true,
      hasGetUserMedia: true,
      hasMediaDevices: true,
      hasMediaRecorder: true,
      isSecureContext: true,
      missing: [],
      supported: true,
    });
  });

  it("reports insecure contexts and missing browser APIs", async () => {
    const { capabilities } = await importCameraWith({
      getUserMedia: null,
      isSecureContext: false,
      mediaRecorder: null,
    });

    const result = capabilities();

    expect(result).toMatchObject({
      canRecordVideo: false,
      canUseCamera: false,
      hasGetUserMedia: false,
      hasMediaDevices: false,
      hasMediaRecorder: false,
      isSecureContext: false,
      missing: ["secure-context", "media-devices", "media-recorder"],
      supported: false,
    });
    expect(result.guidance).toEqual(
      expect.arrayContaining([
        expect.stringContaining("HTTPS or localhost"),
        expect.stringContaining("does not support camera capture"),
        expect.stringContaining("Video recording is not supported"),
      ]),
    );
  });

  it("reports getUserMedia missing when mediaDevices exists without it", async () => {
    const { capabilities } = await importCameraWith({
      getUserMedia: null,
      isSecureContext: true,
      mediaDevices: {},
      mediaRecorder: function MediaRecorder() {},
    });

    expect(capabilities()).toMatchObject({
      canRecordVideo: false,
      canUseCamera: false,
      hasGetUserMedia: false,
      hasMediaDevices: true,
      hasMediaRecorder: true,
      isSecureContext: true,
      missing: ["get-user-media"],
      supported: false,
    });
  });

  it("returns copies of array fields", async () => {
    const { capabilities } = await importCameraWith({
      getUserMedia: null,
      isSecureContext: false,
      mediaRecorder: null,
    });

    const first = capabilities();
    first.missing.push("mutated");
    first.guidance.push("mutated");

    expect(capabilities().missing).not.toContain("mutated");
    expect(capabilities().guidance).not.toContain("mutated");
  });
});

async function importCameraWith({
  getUserMedia,
  isSecureContext,
  mediaDevices,
  mediaRecorder,
}) {
  vi.resetModules();
  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    value: isSecureContext,
  });
  Object.defineProperty(window, "MediaRecorder", {
    configurable: true,
    value: mediaRecorder || undefined,
  });
  vi.stubGlobal("navigator", {
    mediaDevices:
      mediaDevices === undefined ? getUserMedia && { getUserMedia } : mediaDevices,
  });

  return import("../js/camera.js");
}
