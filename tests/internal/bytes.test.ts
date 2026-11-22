import { expect, it } from "vitest";
import { toWebBytes } from "../../src/internal/bytes.js";

it("preserves the offset and length of a byte view without copying", () => {
  const source = new Uint8Array([0, 1, 2, 3]);
  const view = toWebBytes(source.subarray(1, 3));
  expect([...view]).toEqual([1, 2]);
  expect(view.buffer).toBe(source.buffer);
});

it.skipIf(typeof SharedArrayBuffer === "undefined")("copies shared memory into a Web API-compatible buffer", () => {
  const source = new Uint8Array(new SharedArrayBuffer(4));
  source.set([0, 1, 2, 3]);
  const view = toWebBytes(source.subarray(1, 3));
  expect([...view]).toEqual([1, 2]);
  expect(view.buffer).toBeInstanceOf(ArrayBuffer);
  source[1] = 9;
  expect(view[0]).toBe(1);
});
