import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { addItem, clearAll, listItems, STORAGE_KEY } from "../js/storage.js";

const existingItem = {
  id: "existing-item",
  type: "photo",
  createdAt: "2026-05-18T19:27:00.000Z",
  data: "data:image/png;base64,existing",
};

const oversizedItem = {
  id: "oversized-item",
  type: "photo",
  createdAt: "2026-05-18T19:28:00.000Z",
  data: "data:image/png;base64,oversized",
};

describe("storage quota handling", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("rolls back addItem and emits storage:quota-exceeded on quota errors", () => {
    clearAll();
    addItem(existingItem);

    const priorValue = localStorage.getItem(STORAGE_KEY);
    const events = [];
    const values = new Map([[STORAGE_KEY, priorValue]]);
    const mockStorage = {
      clear: vi.fn(() => values.clear()),
      getItem: vi.fn((key) => (values.has(key) ? values.get(key) : null)),
      removeItem: vi.fn((key) => values.delete(key)),
      setItem: vi.fn((key, value) => {
        if (key === STORAGE_KEY && value.includes(oversizedItem.id)) {
          throw new DOMException("Storage quota exceeded.", "QuotaExceededError");
        }

        values.set(key, value);
      }),
    };

    window.addEventListener("storage:quota-exceeded", (event) => {
      events.push(event);
    });

    vi.stubGlobal("localStorage", mockStorage);

    expect(() => addItem(oversizedItem)).toThrow(DOMException);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(priorValue);
    expect(listItems()).toEqual([existingItem]);
    expect(events).toHaveLength(1);
    expect(events[0].detail).toMatchObject({
      itemId: oversizedItem.id,
      itemType: oversizedItem.type,
      key: STORAGE_KEY,
    });
  });
});
