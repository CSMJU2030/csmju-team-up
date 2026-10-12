import { weightedProgress } from "../src/progress/project-progress.service.js";

describe("project weighted progress", () => {
  it("calculates progress only from completed task weight", () => {
    expect(weightedProgress([
      { status: "COMPLETED", weight: 3 },
      { status: "TODO", weight: 1 },
    ])).toBe(75);
  });

  it("returns zero when there are no tasks", () => {
    expect(weightedProgress([])).toBe(0);
  });

  it("does not count blocked or review tasks as complete", () => {
    expect(weightedProgress([
      { status: "BLOCKED", weight: 2 },
      { status: "IN_REVIEW", weight: 3 },
      { status: "COMPLETED", weight: 5 },
    ])).toBe(50);
  });
});
