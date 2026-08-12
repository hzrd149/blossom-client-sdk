import { describe, expect, it } from "vitest";

import {
  HashtreeBoundsError,
  HashtreeCallbackError,
  HashtreeConflictError,
  HashtreeError,
  HashtreeIntegrityError,
  HashtreeLifecycleError,
  HashtreeValidationError,
  ImmutableTreeError,
} from "../../src/hashtree/errors.js";

const errorClasses = [
  HashtreeValidationError,
  HashtreeIntegrityError,
  HashtreeConflictError,
  ImmutableTreeError,
  HashtreeCallbackError,
  HashtreeLifecycleError,
] as const;

describe("Hashtree error hierarchy", () => {
  it.each(errorClasses)("preserves identity and name for %s", (ErrorClass) => {
    const error = new ErrorClass("Useful failure detail");

    expect(error).toBeInstanceOf(ErrorClass);
    expect(error).toBeInstanceOf(HashtreeError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe(ErrorClass.name);
    expect(error.message).toContain("failure");
  });

  it("preserves safe operation, path, and cause context", () => {
    const cause = new Error("upstream rejection");
    const error = new HashtreeCallbackError("Callback failed while reading", {
      operation: "read",
      path: "/documents/readme.md",
      cause,
    });

    expect(error.operation).toBe("read");
    expect(error.path).toBe("/documents/readme.md");
    expect(error.cause).toBe(cause);
  });

  it("preserves numeric bounds context", () => {
    const error = new HashtreeBoundsError("Directory exceeds the supported link count", {
      operation: "encodeDirectory",
      path: "/documents",
      limit: 174,
      actual: 175,
    });

    expect(error).toBeInstanceOf(HashtreeBoundsError);
    expect(error).toBeInstanceOf(HashtreeError);
    expect(error.name).toBe("HashtreeBoundsError");
    expect(error.limit).toBe(174);
    expect(error.actual).toBe(175);
    expect(error.message).toContain("link count");
  });

  it("does not retain or serialize arbitrary sensitive context or error codes", () => {
    const options = {
      operation: "decrypt",
      path: "/private/file",
      cause: new Error("cipher rejected"),
      rawBytes: new Uint8Array([1, 2, 3]),
      credential: "secret-token",
      callbackInput: { private: true },
      code: "DECRYPTION_FAILED",
    };
    const error = new HashtreeIntegrityError("Integrity verification failed", options);
    const serialized = JSON.stringify(error);

    expect(error).not.toHaveProperty("rawBytes");
    expect(error).not.toHaveProperty("credential");
    expect(error).not.toHaveProperty("callbackInput");
    expect(error).not.toHaveProperty("code");
    expect(error).not.toHaveProperty("toJSON");
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("DECRYPTION_FAILED");
    expect(serialized).not.toContain("rawBytes");
  });
});
