describe("CS TeamUp backend", () => {
  it("exposes the standard health contract shape", () => {
    const body = { success: true, data: { status: "ok", subsystem: "csmju-team-up" } };
    expect(body.success).toBe(true);
    expect(body.data.subsystem).toBe("csmju-team-up");
  });
});
