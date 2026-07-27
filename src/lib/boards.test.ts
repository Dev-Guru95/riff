import { describe, it, expect } from "vitest";
import { capabilitiesFor, parseMentions } from "./boards";
import { BOARD_ROLES, type BoardRole } from "./constants";

describe("parseMentions", () => {
  const members = [
    { userId: "u1", name: "Demo Artist", email: "demo@riff.app" },
    { userId: "u2", name: "Lo Fi Lena", email: "lena@riff.app" },
  ];

  it("matches @handle (display name without spaces, case-insensitive)", () => {
    expect(parseMentions("hey @DemoArtist look", members)).toEqual(["u1"]);
    expect(parseMentions("hey @demoartist", members)).toEqual(["u1"]);
  });

  it("matches @email-local-part", () => {
    expect(parseMentions("ping @lena please", members)).toEqual(["u2"]);
  });

  it("returns multiple distinct ids and de-dupes", () => {
    const r = parseMentions("@DemoArtist @lena @demoartist", members);
    expect(r.sort()).toEqual(["u1", "u2"]);
  });

  it("ignores unknown handles and text without mentions", () => {
    expect(parseMentions("no mentions here", members)).toEqual([]);
    expect(parseMentions("@nobody", members)).toEqual([]);
  });
});

describe("board capabilities", () => {
  it("owner can do everything, including deleting the board", () => {
    const c = capabilitiesFor("owner");
    expect(c.view && c.editCards && c.manageColumns && c.manageBoard && c.manageMembers && c.deleteBoard).toBe(true);
  });

  it("only the owner can delete the board", () => {
    for (const role of BOARD_ROLES) {
      expect(capabilitiesFor(role).deleteBoard).toBe(role === "owner");
    }
  });

  it("admin manages the board & members but cannot delete it", () => {
    const c = capabilitiesFor("admin");
    expect(c.manageBoard).toBe(true);
    expect(c.manageMembers).toBe(true);
    expect(c.deleteBoard).toBe(false);
  });

  it("manager runs columns/labels and assigns others, but not board settings/members", () => {
    const c = capabilitiesFor("manager");
    expect(c.manageColumns && c.manageLabels && c.assignOthers && c.editCards).toBe(true);
    expect(c.manageBoard || c.manageMembers).toBe(false);
  });

  it("member can edit cards but not columns or assign others", () => {
    const c = capabilitiesFor("member");
    expect(c.editCards).toBe(true);
    expect(c.manageColumns).toBe(false);
    expect(c.assignOthers).toBe(false);
  });

  it("guest is read + comment only", () => {
    const c = capabilitiesFor("guest");
    expect(c.view).toBe(true);
    expect(c.comment).toBe(true);
    expect(c.editCards).toBe(false);
  });

  it("privilege is monotonic: each capability, once granted, stays granted up the ladder", () => {
    // BOARD_ROLES is ordered most→least privileged.
    const ranked = [...BOARD_ROLES].reverse(); // least → most
    const caps = ranked.map((r: BoardRole) => capabilitiesFor(r));
    const keys = Object.keys(caps[0]) as (keyof (typeof caps)[number])[];
    for (const k of keys) {
      let seenTrue = false;
      for (const c of caps) {
        if (c[k]) seenTrue = true;
        // once true at a lower rank, must remain true at every higher rank
        if (seenTrue) expect(c[k]).toBe(true);
      }
    }
  });
});
