const MIN_LEVEL = 0;
const MAX_LEVEL = 100;

const NEUTRAL_PARAMS = Object.freeze({
  brightness: 1,
  contrast: 1,
  saturation: 1,
  warmth: 0,
});

const NO_OP_SPEC = Object.freeze({
  cssFilter: "none",
  smoothing: Object.freeze({ blurPx: 0 }),
  glow: Object.freeze({ blurPx: 0, alpha: 0 }),
  params: NEUTRAL_PARAMS,
});

export function filterSpec(beautyLevel) {
  const level = normalizeBeautyLevel(beautyLevel);

  if (level === 0) {
    return cloneSpec(NO_OP_SPEC);
  }

  const intensity = level / MAX_LEVEL;
  const params = {
    brightness: round(1 + intensity * 0.08),
    contrast: round(1 + intensity * 0.06),
    saturation: round(1 + intensity * 0.12),
    warmth: round(intensity),
  };
  const smoothing = {
    blurPx: round(intensity * 1.8),
  };
  const glow = {
    blurPx: round(2 + intensity * 10),
    alpha: round(0.08 + intensity * 0.22),
  };

  return {
    cssFilter: [
      `brightness(${params.brightness})`,
      `contrast(${params.contrast})`,
      `saturate(${params.saturation})`,
      `sepia(${round(params.warmth * 0.12)})`,
      `blur(${smoothing.blurPx}px)`,
    ].join(" "),
    smoothing,
    glow,
    params,
  };
}

export function applyToCanvas(ctx, source, w, h, beautyLevel) {
  assertCanvasContext(ctx);
  assertDrawableSource(source);

  const width = normalizeDimension(w, "w");
  const height = normalizeDimension(h, "h");
  const spec = filterSpec(beautyLevel);

  ctx.save();
  try {
    ctx.clearRect(0, 0, width, height);
    ctx.filter = spec.cssFilter;
    ctx.drawImage(source, 0, 0, width, height);

    if (spec.glow.alpha > 0) {
      ctx.globalAlpha = spec.glow.alpha;
      ctx.globalCompositeOperation = "screen";
      ctx.filter = buildGlowFilter(spec);
      ctx.drawImage(source, 0, 0, width, height);
    }
  } finally {
    ctx.restore();
  }

  return spec;
}

function normalizeBeautyLevel(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return MIN_LEVEL;
  }

  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(numberValue)));
}

function normalizeDimension(value, fieldName) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${fieldName} must be a positive finite number.`);
  }

  return Math.floor(value);
}

function assertCanvasContext(ctx) {
  if (
    !ctx ||
    typeof ctx.clearRect !== "function" ||
    typeof ctx.drawImage !== "function" ||
    typeof ctx.save !== "function" ||
    typeof ctx.restore !== "function"
  ) {
    throw new TypeError("applyToCanvas requires a CanvasRenderingContext2D-like context.");
  }
}

function assertDrawableSource(source) {
  if (!source) {
    throw new TypeError("applyToCanvas requires a drawable source.");
  }
}

function buildGlowFilter(spec) {
  const baseFilter = spec.cssFilter === "none" ? "" : `${spec.cssFilter} `;

  return `${baseFilter}blur(${spec.glow.blurPx}px)`;
}

function cloneSpec(spec) {
  return {
    cssFilter: spec.cssFilter,
    smoothing: { ...spec.smoothing },
    glow: { ...spec.glow },
    params: { ...spec.params },
  };
}

function round(value) {
  return Number(value.toFixed(3));
}
