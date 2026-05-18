import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  addItem,
  clearAll,
  removeItem,
  STORAGE_CHANGED_EVENT,
  STORAGE_KEY,
} from "../js/storage.js";

const item = {
  id: "changed-item",
  type: "photo",
  createdAt: "2026-05-18T19:29:00.000Z",
  data: "data:image/png;base64,changed",
};

describe("storage changed events", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("emits storage:changed after addItem succeeds", () => {
    const events = collectStorageChangedEvents();

    addItem(item);
    events.stop();

    expect(events.items).toHaveLength(1);
    expect(events.items[0].detail).toMatchObject({
      action: "add",
      itemId: item.id,
      itemType: item.type,
      key: STORAGE_KEY,
    });
  });

  it("emits storage:changed after removeItem succeeds", () => {
    addItem(item);
    const events = collectStorageChangedEvents();

    expect(removeItem(item.id)).toBe(true);
    events.stop();

    expect(events.items).toHaveLength(1);
    expect(events.items[0].detail).toMatchObject({
      action: "remove",
      itemId: item.id,
      key: STORAGE_KEY,
    });
  });

  it("does not emit storage:changed when removeItem does not mutate", () => {
    const events = collectStorageChangedEvents();

    expect(removeItem("missing-item")).toBe(false);
    events.stop();

    expect(events.items).toEqual([]);
  });

  it("emits storage:changed after clearAll succeeds", () => {
    addItem(item);
    const events = collectStorageChangedEvents();

    clearAll();
    events.stop();

    expect(events.items).toHaveLength(1);
    expect(events.items[0].detail).toMatchObject({
      action: "clear",
      key: STORAGE_KEY,
    });
  });
});

function collectStorageChangedEvents() {
  const items = [];
  const handler = (event) => {
    items.push(event);
  };

  window.addEventListener(STORAGE_CHANGED_EVENT, handler);

  return {
    items,
    stop() {
      window.removeEventListener(STORAGE_CHANGED_EVENT, handler);
    },
  };
}
