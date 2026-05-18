import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  addItem,
  clearAll,
  listItems,
  removeItem,
  SCHEMA_VERSION,
  STORAGE_KEY,
} from "../js/storage.js";

const photoItem = {
  id: "photo-item",
  type: "photo",
  createdAt: "2026-05-18T19:31:00.000Z",
  data: "data:image/png;base64,photo",
};

const videoItem = {
  id: "video-item",
  type: "video",
  createdAt: "2026-05-18T19:32:00.000Z",
  data: "data:video/webm;base64,video",
  duration: 12.5,
};

describe("storage CRUD", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("lists an empty collection when storage has not been initialized", () => {
    expect(listItems()).toEqual([]);
  });

  it("adds items and returns cloned item data", () => {
    const addedItem = addItem(photoItem);
    addedItem.data = "mutated";

    expect(addedItem).toMatchObject({
      id: photoItem.id,
      type: photoItem.type,
      createdAt: photoItem.createdAt,
    });
    expect(listItems()).toEqual([photoItem]);
  });

  it("removes items by id and reports whether storage changed", () => {
    addItem(photoItem);
    addItem(videoItem);

    expect(removeItem(photoItem.id)).toBe(true);
    expect(removeItem("missing-item")).toBe(false);
    expect(listItems()).toEqual([videoItem]);
  });

  it("clears all items while preserving the storage schema", () => {
    addItem(photoItem);

    clearAll();

    expect(listItems()).toEqual([]);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual({
      schemaVersion: SCHEMA_VERSION,
      items: [],
    });
  });
});

describe("storage schema", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("writes the expected schema version and item payload", () => {
    addItem(videoItem);

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual({
      schemaVersion: SCHEMA_VERSION,
      items: [videoItem],
    });
  });

  it("reads items from the JSON schema payload", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        items: [photoItem, videoItem],
      }),
    );

    expect(listItems()).toEqual([photoItem, videoItem]);
  });
});
