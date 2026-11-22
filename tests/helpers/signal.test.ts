import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimeoutError, wrapSignalWithTimeout } from "../../src/helpers/signal.js";

describe("wrapSignalWithTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should create an AbortSignal with timeout", () => {
    const { signal, cancel } = wrapSignalWithTimeout(1000, "Timeout occurred", undefined);

    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal.aborted).toBe(false);
    expect(typeof cancel).toBe("function");
  });

  it("should abort after timeout", () => {
    const { signal } = wrapSignalWithTimeout(1000, "Timeout occurred", undefined);

    vi.advanceTimersByTime(999);
    expect(signal.aborted).toBe(false);

    vi.advanceTimersByTime(1);
    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBeInstanceOf(TimeoutError);
    expect(signal.reason.message).toBe("Timeout occurred");
  });

  it("should cancel timeout when cancel is called", () => {
    const { signal, cancel } = wrapSignalWithTimeout(1000, "Timeout occurred", undefined);

    cancel();
    vi.advanceTimersByTime(2000);
    expect(signal.aborted).toBe(false);
  });

  it("should respect existing AbortSignal", () => {
    const existingController = new AbortController();
    const { signal } = wrapSignalWithTimeout(1000, "Timeout occurred", existingController.signal);

    existingController.abort("User aborted");

    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBe("User aborted");
  });

  it("preserves an already-aborted signal and its reason", () => {
    const reason = new Error("Stopped");
    const { signal, cancel } = wrapSignalWithTimeout(1000, "Timeout", AbortSignal.abort(reason));
    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBe(reason);
    cancel();
  });

  it("still forwards cancellation after the timeout has been cleared", () => {
    const controller = new AbortController();
    const { signal, cancel } = wrapSignalWithTimeout(1000, "Timeout", controller.signal);
    cancel();
    controller.abort("Stop reading the body");
    expect(signal.reason).toBe("Stop reading the body");
  });
});
