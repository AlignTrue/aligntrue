import { describe, expect, it } from "vitest";
import { Identity } from "../src/index.js";

describe("identity canonicalize + hash", () => {
  it("canonicalize is deterministic", () => {
    const value = { b: 2, a: 1 };
    const first = Identity.canonicalize(value as never);
    const second = Identity.canonicalize(value as never);
    expect(first).toBe(second);
  });

  it("hash is stable across runs", () => {
    const value = { a: [1, 2, 3] };
    const first = Identity.hashCanonical(value);
    const second = Identity.hashCanonical(value);
    expect(first).toBe(second);
  });

  it("hash changes with content", () => {
    const a = Identity.hashCanonical({ value: 1 });
    const b = Identity.hashCanonical({ value: 2 });
    expect(a).not.toBe(b);
  });
});

describe("id generation", () => {
  it("generates deterministic ids from content", () => {
    const id1 = Identity.deterministicId({ x: 1 });
    const id2 = Identity.deterministicId({ x: 1 });
    expect(id1).toBe(id2);
  });

  it("random ids differ", () => {
    const id1 = Identity.randomId();
    const id2 = Identity.randomId();
    expect(id1).not.toBe(id2);
  });
});
