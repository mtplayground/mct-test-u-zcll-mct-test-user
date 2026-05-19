import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  addItem,
  clearAll,
  LEGACY_STORAGE_KEY,
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
  beautyLevel: 0,
};

const videoItem = {
  id: "video-item",
  type: "video",
  createdAt: "2026-05-18T19:32:00.000Z",
  data: "data:video/webm;base64,video",
  beautyLevel: 35,
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

  it("migrates v1 items to v2 with beautyLevel 0 without deleting v1", () => {
    const legacyStore = {
      schemaVersion: 1,
      items: [
        {
          id: "legacy-photo",
          type: "photo",
          createdAt: "2026-05-18T20:00:00.000Z",
          data: "data:image/png;base64,legacy",
        },
      ],
    };
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacyStore));

    expect(listItems()).toEqual([
      {
        ...legacyStore.items[0],
        beautyLevel: 0,
      },
    ]);
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBe(JSON.stringify(legacyStore));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual({
      schemaVersion: SCHEMA_VERSION,
      items: [
        {
          ...legacyStore.items[0],
          beautyLevel: 0,
        },
      ],
    });
  });

  it("prefers v2 storage when both v1 and v2 are present", () => {
    localStorage.setItem(
      LEGACY_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        items: [
          {
            id: "legacy-photo",
            type: "photo",
            createdAt: "2026-05-18T20:00:00.000Z",
            data: "data:image/png;base64,legacy",
          },
        ],
      }),
    );
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        items: [videoItem],
      }),
    );

    expect(listItems()).toEqual([videoItem]);
  });

  it("defaults missing beauty levels to 0 and clamps stored values", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        items: [
          {
            id: "missing-beauty",
            type: "photo",
            createdAt: "2026-05-18T20:00:00.000Z",
            data: "data:image/png;base64,missing",
          },
          {
            id: "high-beauty",
            type: "photo",
            createdAt: "2026-05-18T20:01:00.000Z",
            data: "data:image/png;base64,high",
            beautyLevel: 140,
          },
        ],
      }),
    );

    expect(listItems()).toEqual([
      {
        id: "missing-beauty",
        type: "photo",
        createdAt: "2026-05-18T20:00:00.000Z",
        data: "data:image/png;base64,missing",
        beautyLevel: 0,
      },
      {
        id: "high-beauty",
        type: "photo",
        createdAt: "2026-05-18T20:01:00.000Z",
        data: "data:image/png;base64,high",
        beautyLevel: 100,
      },
    ]);
  });
});
