import { describe, expect, it } from "vitest";
import { GoogleApiError, TokenExpiredError } from "../src/errors.js";

describe("google-common errors", () => {
  it("truncates response bodies to avoid leaking data", () => {
    const longBody = "x".repeat(500);
    const error = new GoogleApiError(500, "/endpoint", longBody);
    const body = (error.context?.body as string) ?? "";
    expect(body.length).toBeLessThanOrEqual(200);
  });

  it("provides a specific error for expired tokens", () => {
    const err = new TokenExpiredError("/test");
    expect(err.code).toBe("GOOGLE_API_ERROR");
    expect(err.status).toBe(401);
  });
});
