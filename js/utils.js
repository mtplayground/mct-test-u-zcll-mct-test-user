export function newId() {
  const cryptoApi = globalThis.crypto;

  if (typeof cryptoApi?.randomUUID === "function") {
    try {
      return cryptoApi.randomUUID();
    } catch {
      return fallbackId(cryptoApi);
    }
  }

  return fallbackId(cryptoApi);
}

export function formatTimestamp(ms) {
  const timestamp = normalizeFiniteNumber(ms, "timestamp");
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    throw new RangeError("timestamp must be a valid millisecond value.");
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDuration(sec) {
  const seconds = Math.floor(normalizeFiniteNumber(sec, "duration"));

  if (seconds < 0) {
    throw new RangeError("duration must be greater than or equal to zero.");
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${padTimePart(minutes)}:${padTimePart(remainingSeconds)}`;
  }

  return `${minutes}:${padTimePart(remainingSeconds)}`;
}

function fallbackId(cryptoApi) {
  if (typeof cryptoApi?.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return bytesToUuid(bytes);
  }

  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 12);
  return `id-${timestamp}-${randomPart}`;
}

function bytesToUuid(bytes) {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

function normalizeFiniteNumber(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number.`);
  }

  return value;
}

function padTimePart(value) {
  return String(value).padStart(2, "0");
}
