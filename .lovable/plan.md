## Add Dedicated Wellness Disclaimer Step to Onboarding

**File:** `src/pages/Onboarding.tsx`

### What changes

1. **Add a new step type** — a `"consent"` type to the `OnboardingStep` union, or simply add a new entry to the `steps` array as a special options step. Cleanest approach: add a `"consent"` type with `title`, `subtitle`, and `body` fields.
2. **Append the consent step as the new final step (index 11)** after the current last step (index 10, "What interests you most?"). Content:
  - Title: `"Before you continue"`
  - Body: `"CarnivoreX is a wellness tracking tool, not a medical service. Nothing in this app constitutes medical advice — consult your physician before making any dietary changes."`
  - CTA: `"I Agree"`
3. **Update rendering logic** (~line 440–670 area) — when `current.type === "consent"`, render a dedicated screen:
  - Title styled like other step titles (`text-[22px] font-extrabold tracking-[-0.02em]`)
  - Body text in `text-[14px] text-muted-foreground leading-relaxed`, prominent but secondary to the title
  - A `Shield` icon at the top for visual anchoring
  - Full-width primary `Button` with "I Agree" label, no chevron
  - No "Skip" option on this step — hide the "Skip for now" link when on the consent step
4. **Update completion logic** (~line 267–343) — the `advance()` function's `else` branch (fires on last step) remains unchanged since `totalSteps` now includes the consent step, so completion only fires when the user taps "I Agree" on step 11.
5. **Update CTA label** (line 669) — change `isLastStep ? "Get Started"` to `isLastStep ? "I Agree"` (this will only render for multi-select/input steps on the last step, but the consent step uses its own button, so this is a safety fallback).
6. **Hide "Skip for now"** (line 677–689) — add `{!isLastStep && (...)}` or `{current.type !== "consent" && (...)}` guard so the skip link doesn't appear on the consent screen.

### What stays unchanged

- All 11 existing steps (indices 0–10), their content, styling, and logic
- The `advance()` completion logic (save to localStorage, profile sync, navigate) — it already fires on the last step
- Design tokens, progress bar, back button, transition animations
- The `legacyAnswers` mapping references `newAnswers[10]` which still works since step 10 remains the interests step

### Technical details

```typescript
// New type addition
interface ConsentStep {
  type: "consent";
  title: string;
  body: string;
  icon: typeof Shield;
}

type OnboardingStep = OptionStep | InputStep | ConsentStep;

// New step appended to steps array
{
  type: "consent",
  title: "Before you continue",
  body: "CarnivoreX is a wellness tracking tool, not a medical service. Nothing in this app constitutes medical advice — consult your physician before making any dietary changes.",
  icon: Shield,
}
```

**One file, four small edits: type definition, step array entry, render branch, skip-link guard.** 

## **Persist Wellness Consent in Database**

We also need to persist onboarding wellness consent at the database level, not just in UI state. A visible consent screen is not enough by itself; we need a stored record of who agreed and when. Consent-record guidance emphasizes retaining a user identifier plus a timestamp for the consent event.

## **Add user/profile attributes**

Add the following fields to the user profile table (or the existing onboarding/profile persistence table, wherever onboarding completion data is stored):

- `wellness_disclaimer_consented` — boolean, default `false`
- `wellness_disclaimer_consented_at` — timestamp with timezone, nullable
- optional but recommended: `wellness_disclaimer_version` — text, nullable or default current version string

## **Consent write behavior**

When the user taps `I Agree` on the dedicated onboarding consent screen:

- set `wellness_disclaimer_consented = true`
- set `wellness_disclaimer_consented_at` to the current server timestamp if possible
- set `wellness_disclaimer_version` to the current disclaimer version string if implemented
- then proceed with the existing onboarding completion flow.

## **Guard behavior**

If onboarding completion depends on this final consent step, do not mark onboarding as fully complete unless the consent fields are successfully saved. If saving fails, show an error and keep the user on the consent screen rather than silently proceeding.

## **What stays unchanged**

- the disclaimer copy,
- the dedicated final onboarding consent screen,
- existing onboarding steps and UI,
- existing completion flow structure, except that consent must now also persist in the database before finishing.

## **My recommendation**

If you want the cleanest implementation, store this on the same profile record that already tracks onboarding completion.