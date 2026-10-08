import { describe, it, expect } from "vitest";
import { bearerToken, isNativeClient, signToken, verifyToken } from "./auth";
import { roleSatisfies } from "./admin";

describe("native-client session tokens", () => {
  it("extracts a bearer token and ignores anything else", () => {
    expect(bearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
    expect(bearerToken("bearer   abc")).toBe("abc");
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken("Bearer")).toBeNull();
    expect(bearerToken(null)).toBeNull();
  });

  it("round-trips a signed session and rejects a tampered or foreign token", () => {
    const token = signToken({ id: "u1", email: "a@b.co", role: "artist" });
    expect(verifyToken(token)).toEqual({ id: "u1", email: "a@b.co", role: "artist" });
    expect(verifyToken(token.slice(0, -2) + "xx")).toBeNull();
    // e.g. the cron route's CRON_SECRET arriving as a bearer value
    expect(verifyToken("not-a-jwt")).toBeNull();
  });

  it("only hands the token back to clients that identify as native", () => {
    expect(isNativeClient(new Request("http://x", { headers: { "x-riff-client": "native" } }))).toBe(true);
    expect(isNativeClient(new Request("http://x"))).toBe(false);
  });
});

describe("staff role checks", () => {
  it("lets admin through everything and scopes reviewer/moderator to their own routes", () => {
    expect(roleSatisfies("admin", "admin")).toBe(true);
    expect(roleSatisfies("admin", "reviewer")).toBe(true);
    expect(roleSatisfies("reviewer", "reviewer")).toBe(true);
    expect(roleSatisfies("moderator", "moderator")).toBe(true);
    expect(roleSatisfies("reviewer", "admin")).toBe(false);
    expect(roleSatisfies("moderator", "admin")).toBe(false);
    expect(roleSatisfies("reviewer", "moderator")).toBe(false);
    expect(roleSatisfies("artist", "reviewer")).toBe(false);
  });
});
