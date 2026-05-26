## What I actually found in the repo

I ran the checks against the live repo state (not a guess). Results:

```
$ grep -E "apple-sign-in|capgo" package.json
    "@capgo/capacitor-social-login": "^8.3.22",

$ grep -c "apple-sign-in" bun.lock package-lock.json
bun.lock:0
package-lock.json:0

$ ls node_modules/@capacitor-community/
speech-recognition
text-to-speech

$ ls node_modules/@capgo/
capacitor-social-login

$ rg -l "apple-sign-in|SignInWithApple|CapacitorCommunityAppleSignIn"
(no matches)
```

So in **this** repository: `@capacitor-community/apple-sign-in` is gone from `package.json`, both lockfiles, `node_modules`, every source file, and `ios/App/CapApp-SPM/Package.swift`. The Capgo plugin is the only Apple login dependency present. The migration on Lovable's side is clean.

## Why your local checks still show it

Two real issues are causing the mismatch:

1. **Your local clone is out of sync.** You're inspecting a working copy that hasn't pulled the migration commits and/or hasn't reinstalled. `npm ls` and `npx cap sync ios` read your local `node_modules`/lockfile, so if you didn't `git pull` + reinstall, they still see the old plugin.
2. **This project uses bun, not npm.** Canonical lockfiles are `bun.lock` + `bun.lockb`. A stale `package-lock.json` (11,916 lines) is also sitting in the repo from an earlier `npm install`. Even though it doesn't currently contain `apple-sign-in`, its presence makes `npm ls` authoritative on your machine and creates a second, divergent dependency graph. This file should not exist.

## Plan

### Repo change (one file)

1. **Delete `package-lock.json` from the repo.** It conflicts with `bun.lock`/`bun.lockb` and is the reason `npm ls` can ever return stale state. Going forward, bun is the single source of truth (matches `scripts/build-android-fresh.sh` and existing tooling).

That's the only repo edit needed — everything else the user request asks for is already true in the repository.

### Terminal steps for you to run locally (line by line)

After I implement the deletion and you pull:

```
cd /path/to/your/repo
git pull
rm -rf node_modules
rm -f package-lock.json bun.lockb
bun install
npx cap sync ios
```

Then run the proof commands:

```
bun pm ls | grep -E "apple-sign-in|capacitor-social-login"
grep -E "apple-sign-in|capgo" package.json
npx cap sync ios 2>&1 | grep -A2 "Found .* Capacitor plugins"
```

Expected:
- `bun pm ls` shows `@capgo/capacitor-social-login@8.3.22`, no `apple-sign-in` line.
- `package.json` shows only the `@capgo/...` line.
- `cap sync ios` plugin list contains `@capgo/capacitor-social-login` and does **not** contain `@capacitor-community/apple-sign-in`.

### Note on `npm ls`

If you specifically want `npm ls` to keep working, you'd have to either (a) regenerate `package-lock.json` via `npm install` after every dependency change, doubling lockfile maintenance, or (b) drop npm and use `bun pm ls`. I recommend (b) because this project's build script and CI all use bun. If you want me to keep `package-lock.json` for `npm ls` compatibility instead, say so and I'll regenerate it cleanly via `npm install --package-lock-only` instead of deleting it.

## Out of scope

- No source/code/iOS-project changes — the Apple migration code is already correct.
- No changes to the `v11` auth proof instrumentation.
