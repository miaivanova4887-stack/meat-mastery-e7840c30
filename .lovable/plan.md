

## Add One-Time Consent Banner to Progress & Profile Pages

### New file: `src/components/ConsentBanner.tsx`

A self-contained component that:
- On mount, checks visibility: queries `profiles.user_attributes` for `consent_given === true`, then falls back to localStorage keys `carnivore-consent-given` or `carnivore-consent-dismissed`. If any is truthy, stays hidden.
- Fetches banner text from `content_blocks` (page=`consent`, section=`banner`, keys `body` and `accept_button`) for the current i18n locale.
- Renders a dismissible card banner with slide-down animation (`animate-fade-in` on appear, transition to hidden on dismiss).
- **"I Accept" button**: Updates `profiles.user_attributes` via Supabase (merge `consent_given: true` into existing JSONB), sets `localStorage carnivore-consent-given = "true"`, dismisses.
- **X close button**: Sets `localStorage carnivore-consent-dismissed = "true"` only, dismisses without DB write.
- Inline "Privacy Policy" text links to `/privacy` via `useNavigate`.
- Styling: `bg-card border border-border/50 rounded-xl mx-4 mt-4 p-4`, orange accent button (`bg-orange-500 hover:bg-orange-600 text-white w-full rounded-lg`), `text-sm text-foreground` body, `text-muted-foreground` X button top-right.

### Change: `src/pages/Progress.tsx`

Import `ConsentBanner` and render `<ConsentBanner />` as the first child inside the main `<div>`, right after the sticky header block (before `<div className="px-4 pt-4 space-y-5">`). No other changes.

### Change: `src/pages/Profile.tsx`

Import `ConsentBanner` and render `<ConsentBanner />` right after the sticky header block (line ~354, before the profile content). No other changes.

### Database: Seed 4 content_blocks rows

Insert via the insert tool:
```sql
INSERT INTO content_blocks (page, section, key, type, locale, value)
VALUES
  ('consent', 'banner', 'body', 'richtext', 'en', 'By creating an account, you agree to our Privacy Policy and consent to the collection and use of your personal and health information so we can deliver a personalized, high-quality experience tailored to you.'),
  ('consent', 'banner', 'body', 'richtext', 'fr', 'En créant un compte, vous acceptez notre Politique de confidentialité et consentez à la collecte et à l''utilisation de vos renseignements personnels et de santé afin que nous puissions vous offrir une expérience personnalisée et de haute qualité.'),
  ('consent', 'banner', 'accept_button', 'text', 'en', 'I Accept'),
  ('consent', 'banner', 'accept_button', 'text', 'fr', 'J''accepte')
ON CONFLICT DO NOTHING;
```

### Files modified
- `src/components/ConsentBanner.tsx` — new file
- `src/pages/Progress.tsx` — add `<ConsentBanner />` import + render
- `src/pages/Profile.tsx` — add `<ConsentBanner />` import + render
- Database insert: 4 rows into `content_blocks`

