import { contributionPointsFor } from "../src/contributions/contributions.service.js";

describe("contribution points", () => {
  it("uses conservative defaults for each verified work size", () => {
    expect(contributionPointsFor("SMALL", {})).toBe(5);
    expect(contributionPointsFor("MEDIUM", {})).toBe(10);
    expect(contributionPointsFor("LARGE", {})).toBe(20);
  });

  it("supports deployment-level configuration", () => {
    expect(contributionPointsFor("MEDIUM", { CONTRIBUTION_POINTS_MEDIUM: "14" })).toBe(14);
    expect(contributionPointsFor("SMALL", { CONTRIBUTION_POINTS_SMALL: "0" })).toBe(0);
  });

  it("rejects invalid configured point values instead of silently changing the rule", () => {
    expect(() => contributionPointsFor("LARGE", { CONTRIBUTION_POINTS_LARGE: "1.5" })).toThrow("CONTRIBUTION_POINTS_LARGE");
    expect(() => contributionPointsFor("SMALL", { CONTRIBUTION_POINTS_SMALL: "1001" })).toThrow("CONTRIBUTION_POINTS_SMALL");
  });
});
