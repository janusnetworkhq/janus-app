import {
  appConfig,
  compileTestOtpEntry,
  DEFAULT_TEST_OTP_PATTERNS,
  effectiveTestOtpEmails,
  isTestOtpAccount,
} from "../src/common/config";

/** Pure unit tests for the test-OTP matcher (no app / DB needed). */
describe("test OTP patterns (unit)", () => {
  const original = [...appConfig.testOtpEmails];
  afterEach(() => {
    appConfig.testOtpEmails = [...original];
  });

  it("built-in qa.* pattern covers the seeded qa.studentNN accounts and the core QA trio", () => {
    expect(DEFAULT_TEST_OTP_PATTERNS).toContain("qa.*@janus.test");
    for (const n of ["01", "05", "10"]) expect(isTestOtpAccount(`qa.student${n}@janus.test`)).toBe(true);
    expect(isTestOtpAccount("qa.student@janus.test")).toBe(true);
    expect(isTestOtpAccount("QA.Admin@JANUS.TEST")).toBe(true);
  });

  it("hard @janus.test guard: real or look-alike domains never match", () => {
    for (const email of [
      "qa.student01@example.com",
      "qa.student01@gmail.com",
      "qa.student01@janus.test.evil.com",
      "qa.student01@evil.janus.test",
      "qa.student01@janus.testx",
      "qa.a@b@janus.test",
      "qa. x@janus.test",
      "@janus.test",
    ]) {
      expect(isTestOtpAccount(email)).toBe(false);
    }
  });

  it("non-qa @janus.test addresses are not test accounts unless explicitly listed", () => {
    expect(isTestOtpAccount("someone.else@janus.test")).toBe(false);
    appConfig.testOtpEmails = [...original, "someone.else@janus.test"];
    expect(isTestOtpAccount("someone.else@janus.test")).toBe(true);
  });

  it("env entries may be globs, limited to the local part and the janus.test domain", () => {
    appConfig.testOtpEmails = ["lab.*@janus.test"];
    expect(isTestOtpAccount("lab.robotics@janus.test")).toBe(true);
    expect(isTestOtpAccount("lab.robotics@example.com")).toBe(false);
    expect(compileTestOtpEntry("*@example.com")).toBeNull();
    expect(compileTestOtpEntry("qa.*@*.test")).toBeNull();
    expect(compileTestOtpEntry("qa.(x)@janus.test")).toBeNull();
    const re = compileTestOtpEntry("qa.*@janus.test")!;
    expect(re.test("qa.student03@janus.test")).toBe(true);
    expect(re.test("qa.x@y@janus.test")).toBe(false);
  });

  it("empty TEST_OTP_EMAILS disables test OTP entirely, including built-in patterns", () => {
    appConfig.testOtpEmails = [];
    expect(isTestOtpAccount("qa.student@janus.test")).toBe(false);
    expect(isTestOtpAccount("qa.student01@janus.test")).toBe(false);
    expect(effectiveTestOtpEmails()).toEqual([]);
  });

  it("invalid env entries are dropped from the effective list", () => {
    appConfig.testOtpEmails = ["outsider@example.com", "qa.admin@janus.test"];
    expect(effectiveTestOtpEmails()).toEqual(["qa.admin@janus.test", "qa.*@janus.test"]);
  });
});
