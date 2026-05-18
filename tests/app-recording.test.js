import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isCurrentlyRecording, runRecordingTask } from "../js/app.js";

describe("recording state guard and countdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps isRecording true while a recording task runs and ticks once per second", async () => {
    const ticks = [];
    let resolveTask;
    const task = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveTask = resolve;
        }),
    );

    const resultPromise = runRecordingTask(task, {
      maxSeconds: 3,
      tick: (secondsLeft) => ticks.push(secondsLeft),
    });

    expect(isCurrentlyRecording()).toBe(true);
    expect(task).toHaveBeenCalledWith({ maxSeconds: 3 });
    expect(ticks).toEqual([3]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(ticks).toEqual([3, 2]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(ticks).toEqual([3, 2, 1]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(ticks).toEqual([3, 2, 1, 0]);
    expect(isCurrentlyRecording()).toBe(true);

    resolveTask("saved");
    await expect(resultPromise).resolves.toBe("saved");
    expect(isCurrentlyRecording()).toBe(false);
    expect(ticks).toEqual([3, 2, 1, 0]);
  });

  it("prevents a second recording while one is already running", async () => {
    let resolveTask;
    const firstTask = () =>
      new Promise((resolve) => {
        resolveTask = resolve;
      });

    const firstRecording = runRecordingTask(firstTask, {
      maxSeconds: 1,
      tick: () => {},
    });

    await expect(runRecordingTask(async () => null)).rejects.toThrow(
      "already in progress",
    );

    resolveTask();
    await firstRecording;
    expect(isCurrentlyRecording()).toBe(false);
  });

  it("clears recording state when the task rejects", async () => {
    await expect(
      runRecordingTask(
        async () => {
          throw new Error("Recorder failed.");
        },
        {
          maxSeconds: 5,
          tick: () => {},
        },
      ),
    ).rejects.toThrow("Recorder failed.");

    expect(isCurrentlyRecording()).toBe(false);
  });
});
