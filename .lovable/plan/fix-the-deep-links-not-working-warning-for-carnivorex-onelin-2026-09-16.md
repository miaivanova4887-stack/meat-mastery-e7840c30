# Fix the "Deep links not working" warning for carnivorex.onelink.me

## What's actually wrong

Two separate things, and only one of them is in the app.

1. **Ownership check.** The marketing-link domain does publish an ownership file, and it lists your Play signing key (starts with A7:2B:BF:99). So ownership itself is set up correctly. Google's report is from the currently published build and re-validates only after a new version goes out.
2. **The link Google tested redirects.** Your app currently claims the *entire* domain `carnivorex.onelink.me`, including its bare root address. That root address answers with an error and every marketing short link is by design a redirect (it sends people to the app or to the store). Google tests the broadest address the app claims, so it reports "non-redirect URL failed" and shows the link as not working.

The fix is to stop claiming the whole domain and claim only the exact link path your marketing links use.

## What I need from you

The template code in your real link — for example, in `https://carnivorex.onelink.me/AbCd/xyz123` the code is `AbCd`. Paste one of your live links and I'll use it. --> [https://carnivorex.onelink.me/kWuX/88ew8g3t](https://carnivorex.onelink.me/kWuX/88ew8g3t)

## What I'll change

- In the Android link rules, replace the domain-wide marketing rule with one scoped to that template path only (`/AbCd` and anything under it). The sign-in link rules and the custom `carnivorex://` rule stay untouched.
- Bump the version to 20 / 1.2.2, since link rules only take effect in a new build.

## What you'll do after

- Build and upload version 20 to Play. I'll give you the commands one line at a time.
- In Play Console, after the new version is live, the deep-link report re-checks the path and the warning clears. Google's note is accurate: existing users must update before the links open the app for them.
- In AppsFlyer, keep the Android app's SHA-256 list as-is; it already carries the right key.

## Note on expectations

Attribution short links are redirects by nature. Scoping the claim to the template path is what makes Google's check pass. If you later want a link that is fully yours end to end (`aos.carnivorex.app/...`), that's a branded-domain setup in AppsFlyer plus a matching app rule — separate task, say the word.