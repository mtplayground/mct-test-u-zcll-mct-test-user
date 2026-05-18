export const STORAGE_KEY = "snapvault:v1:items";
export const SCHEMA_VERSION = 1;
export const STORAGE_CHANGED_EVENT = "storage:changed";
export const STORAGE_QUOTA_EXCEEDED_EVENT = "storage:quota-exceeded";

export function listItems() {
  return readStore().items.map(cloneItem);
}

export function addItem(item) {
  const nextItem = normalizeItem(item);
  const storage = getStorage();
  const priorValue = storage.getItem(STORAGE_KEY);
  const store = readStore();

  if (store.items.some((storedItem) => storedItem.id === nextItem.id)) {
    throw new Error(`Storage item already exists: ${nextItem.id}`);
  }

  store.items.push(nextItem);
  try {
    writeStore(store, storage);
  } catch (error) {
    if (isQuotaExceededError(error)) {
      restorePriorState(storage, priorValue);
      emitQuotaExceeded(nextItem, error);
    }

    throw error;
  }

  const addedItem = cloneItem(nextItem);
  emitStorageChanged("add", {
    itemId: addedItem.id,
    itemType: addedItem.type,
  });

  return addedItem;
}

export function removeItem(id) {
  const itemId = normalizeId(id);
  const store = readStore();
  const nextItems = store.items.filter((item) => item.id !== itemId);

  if (nextItems.length === store.items.length) {
    return false;
  }

  writeStore(createStore(nextItems));
  emitStorageChanged("remove", {
    itemId,
  });
  return true;
}

export function clearAll() {
  writeStore(createStore());
  emitStorageChanged("clear");
}

function readStore() {
  const rawValue = getStorage().getItem(STORAGE_KEY);

  if (rawValue === null) {
    return createStore();
  }

  let parsedValue;
  try {
    parsedValue = JSON.parse(rawValue);
  } catch (error) {
    throw new Error("Storage data is not valid JSON.", { cause: error });
  }

  return normalizeStore(parsedValue);
}

function writeStore(store, storage = getStorage()) {
  const nextStore = normalizeStore(store);
  storage.setItem(STORAGE_KEY, JSON.stringify(nextStore));
}

function createStore(items = []) {
  return {
    schemaVersion: SCHEMA_VERSION,
    items,
  };
}

function normalizeStore(value) {
  if (!isRecord(value)) {
    throw new Error("Storage data must be an object.");
  }

  if (value.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Unsupported storage schema version: ${value.schemaVersion}`);
  }

  if (!Array.isArray(value.items)) {
    throw new Error("Storage data must include an items array.");
  }

  return createStore(value.items.map(normalizeItem));
}

function normalizeItem(item) {
  if (!isRecord(item)) {
    throw new TypeError("Storage item must be an object.");
  }

  const nextItem = {
    id: normalizeId(item.id),
    type: normalizeRequiredString(item.type, "type"),
    createdAt: normalizeRequiredString(item.createdAt, "createdAt"),
    data: normalizeRequiredString(item.data, "data"),
  };

  if (Object.hasOwn(item, "duration") && item.duration !== undefined) {
    nextItem.duration = normalizeDuration(item.duration);
  }

  return nextItem;
}

function normalizeId(id) {
  return normalizeRequiredString(id, "id");
}

function normalizeRequiredString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`Storage item ${fieldName} must be a non-empty string.`);
  }

  return value;
}

function normalizeDuration(duration) {
  if (typeof duration !== "number" || !Number.isFinite(duration) || duration < 0) {
    throw new TypeError("Storage item duration must be a non-negative number.");
  }

  return duration;
}

function cloneItem(item) {
  return { ...item };
}

function getStorage() {
  if (typeof localStorage === "undefined") {
    throw new Error("localStorage is not available in this browser.");
  }

  return localStorage;
}

function restorePriorState(storage, priorValue) {
  if (priorValue === null) {
    storage.removeItem(STORAGE_KEY);
    return;
  }

  storage.setItem(STORAGE_KEY, priorValue);
}

function emitQuotaExceeded(item, error) {
  dispatchStorageEvent(STORAGE_QUOTA_EXCEEDED_EVENT, {
    error,
    itemId: item.id,
    itemType: item.type,
    key: STORAGE_KEY,
  });
}

function emitStorageChanged(action, detail = {}) {
  dispatchStorageEvent(STORAGE_CHANGED_EVENT, {
    action,
    key: STORAGE_KEY,
    ...detail,
  });
}

function dispatchStorageEvent(eventName, detail) {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") {
    return;
  }

  const CustomEventConstructor = window.CustomEvent;
  if (typeof CustomEventConstructor !== "function") {
    return;
  }

  window.dispatchEvent(
    new CustomEventConstructor(eventName, {
      detail,
    }),
  );
}

function isQuotaExceededError(error) {
  if (!isRecord(error)) {
    return false;
  }

  return (
    error.name === "QuotaExceededError" ||
    error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    error.code === 22 ||
    error.code === 1014
  );
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
