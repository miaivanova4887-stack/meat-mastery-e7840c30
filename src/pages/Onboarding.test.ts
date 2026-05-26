import { describe, it, expect, beforeEach } from "vitest";
import { isOnboardingComplete } from "./Onboarding";

/**
 * Locks in the new-user onboarding gate. `Index.tsx` redirects to
 * `/onboarding` whenever this helper returns false. The gate requires
 * BOTH the v3 completion flag AND a saved answers payload, so a stray
 * `"true"` write (e.g. from a removed Skip path or backup restore)
 * cannot bypass onboarding. Legacy v1/v2 flags are intentionally ignored
 * so devices whose localStorage was restored from an iCloud / Android
 * Auto Backup are re-onboarded on the first launch of this build.
 */
describe("isOnboardingComplete", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns false for a fresh install (empty localStorage)", () => {
    expect(isOnboardingComplete()).toBe(false);
  });

  it("returns true only when both the v3 flag AND answers are present", () => {
    localStorage.setItem("carnivore-onboarding-complete-v3", "true");
    localStorage.setItem("carnivore-onboarding-answers", "[0,0,[],0,[]]");
    expect(isOnboardingComplete()).toBe(true);
  });

  it("returns false when the flag is set but answers are missing", () => {
    localStorage.setItem("carnivore-onboarding-complete-v3", "true");
    expect(isOnboardingComplete()).toBe(false);
  });

  it("returns false when only legacy v2/v1 flags are present (backup restore case)", () => {
    localStorage.setItem("carnivore-onboarding-complete-v2", "true");
    localStorage.setItem("carnivore-onboarding-complete", "true");
    localStorage.setItem("carnivore-onboarding-answers", "[0,0,[],0,[]]");
    expect(isOnboardingComplete()).toBe(false);
  });

  it("returns false after Profile 'Reset onboarding' clears the keys", () => {
    localStorage.setItem("carnivore-onboarding-complete-v3", "true");
    localStorage.setItem("carnivore-onboarding-answers", "[0,0,[],0,[]]");
    localStorage.removeItem("carnivore-onboarding-complete-v3");
    localStorage.removeItem("carnivore-onboarding-answers");
    localStorage.removeItem("carnivore-onboarding-body");
    expect(isOnboardingComplete()).toBe(false);
  });

  it.each(["1", "yes", "TRUE", "completed", ""])(
    "returns false for non-'true' value %j (strict equality)",
    (value) => {
      localStorage.setItem("carnivore-onboarding-complete-v3", value);
      localStorage.setItem("carnivore-onboarding-answers", "[0,0,[],0,[]]");
      expect(isOnboardingComplete()).toBe(false);
    },
  );
});
