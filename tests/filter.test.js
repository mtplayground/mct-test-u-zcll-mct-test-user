import { describe, expect, it, vi } from "vitest";

import { applyToCanvas, filterSpec } from "../js/filter.js";

describe("filterSpec", () => {
  it("returns a strict no-op descriptor at level 0", () => {
    expect(filterSpec(0)).toEqual({
      cssFilter: "none",
      smoothing: { blurPx: 0 },
      glow: { blurPx: 0, alpha: 0 },
      params: {
        brightness: 1,
        contrast: 1,
        saturation: 1,
        warmth: 0,
      },
    });
  });

  it("clamps invalid and out-of-range levels into the slider range", () => {
    expect(filterSpec(Number.NaN)).toEqual(filterSpec(0));
    expect(filterSpec(-20)).toEqual(filterSpec(0));
    expect(filterSpec(150)).toEqual(filterSpec(100));
  });

  it("maps levels deterministically with increasing beauty parameters", () => {
    const low = filterSpec(25);
    const high = filterSpec(75);

    expect(filterSpec(25)).toEqual(low);
    expect(low.cssFilter).toContain("brightness(");
    expect(low.cssFilter).toContain("blur(");
    expect(high.params.brightness).toBeGreaterThan(low.params.brightness);
    expect(high.params.contrast).toBeGreaterThan(low.params.contrast);
    expect(high.params.saturation).toBeGreaterThan(low.params.saturation);
    expect(high.params.warmth).toBeGreaterThan(low.params.warmth);
    expect(high.smoothing.blurPx).toBeGreaterThan(low.smoothing.blurPx);
    expect(high.glow.blurPx).toBeGreaterThan(low.glow.blurPx);
    expect(high.glow.alpha).toBeGreaterThan(low.glow.alpha);
  });

  it("returns independent descriptor objects", () => {
    const spec = filterSpec(0);
    spec.glow.alpha = 1;

    expect(filterSpec(0).glow.alpha).toBe(0);
  });
});

describe("applyToCanvas", () => {
  it("clears and draws the source with the level filter", () => {
    const ctx = createContextStub();
    const source = {};

    const spec = applyToCanvas(ctx, source, 640.9, 480.2, 0);

    expect(spec.cssFilter).toBe("none");
    expect(ctx.save).toHaveBeenCalledTimes(1);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 640, 480);
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
    expect(ctx.drawImage).toHaveBeenCalledWith(source, 0, 0, 640, 480);
    expect(ctx.filterAssignments).toEqual(["none"]);
    expect(ctx.restore).toHaveBeenCalledTimes(1);
  });

  it("composites a soft-glow pass with globalAlpha for non-zero levels", () => {
    const ctx = createContextStub();
    const source = {};
    const spec = filterSpec(50);

    expect(applyToCanvas(ctx, source, 320, 240, 50)).toEqual(spec);
    expect(ctx.drawImage).toHaveBeenCalledTimes(2);
    expect(ctx.filterAssignments[0]).toBe(spec.cssFilter);
    expect(ctx.filterAssignments[1]).toContain(`blur(${spec.glow.blurPx}px)`);
    expect(ctx.globalAlphaAssignments).toEqual([spec.glow.alpha]);
    expect(ctx.globalCompositeOperationAssignments).toEqual(["screen"]);
  });

  it("restores the context when drawing fails", () => {
    const ctx = createContextStub();
    const error = new Error("draw failed");
    ctx.drawImage.mockImplementation(() => {
      throw error;
    });

    expect(() => applyToCanvas(ctx, {}, 100, 100, 20)).toThrow(error);
    expect(ctx.restore).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid contexts, sources, and dimensions", () => {
    expect(() => applyToCanvas(null, {}, 100, 100, 0)).toThrow(TypeError);
    expect(() => applyToCanvas(createContextStub(), null, 100, 100, 0)).toThrow(
      TypeError,
    );
    expect(() => applyToCanvas(createContextStub(), {}, 0, 100, 0)).toThrow(
      RangeError,
    );
  });
});

function createContextStub() {
  const state = {
    filter: "none",
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
  };
  const ctx = {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    filterAssignments: [],
    globalAlphaAssignments: [],
    globalCompositeOperationAssignments: [],
    restore: vi.fn(),
    save: vi.fn(),
  };

  Object.defineProperty(ctx, "filter", {
    get: () => state.filter,
    set: (value) => {
      state.filter = value;
      ctx.filterAssignments.push(value);
    },
  });
  Object.defineProperty(ctx, "globalAlpha", {
    get: () => state.globalAlpha,
    set: (value) => {
      state.globalAlpha = value;
      ctx.globalAlphaAssignments.push(value);
    },
  });
  Object.defineProperty(ctx, "globalCompositeOperation", {
    get: () => state.globalCompositeOperation,
    set: (value) => {
      state.globalCompositeOperation = value;
      ctx.globalCompositeOperationAssignments.push(value);
    },
  });

  return ctx;
}
