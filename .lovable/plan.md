# Device exclusion rules — recommendation

This page is the Play Console **Device catalogue → Device exclusion rules**. It has nothing to do with the data safety or content declarations; it only controls which physical devices are allowed to install the app. Nothing here requires code changes.

## What each setting does

- **Exclusion rules** — filters on hardware attributes (RAM, SDK level, screen size, OpenGL, CPU model). Any device matching a rule cannot install or update the app, and it also disappears from your install base.
- **Play Integrity** — hides the app from devices that fail Google's device-integrity check (uncertified, rooted, emulators). Separate from exclusion rules and off unless configured.
- **Android Go devices** — Include or Exclude the low-memory Android Go edition (1–2 GB RAM, memory-restricted WebView).

## Recommendation for CarnivoreX

| Setting | Recommendation |
| --- | --- |
| RAM rule | Change `<= 2048 MB` to **`<= 1024 MB`** |
| Android Go devices | Keep **Exclude** |
| Play Integrity | Leave **unconfigured** for now |
| Other rules | Add none |

Reasoning:

- **RAM 2048 MB is too aggressive.** It removes every 2 GB device, which is still a large share of budget Android phones in emerging markets and some older Samsung/Motorola models in North America. This app is a Capacitor WebView app with images and a Health Connect read path — it is heavier than a native list app, but it runs fine in 2 GB. Excluding at 1024 MB removes only the genuinely unusable devices.
- **Keep Android Go excluded.** Go edition caps WebView memory and background processes; a React/WebView app with photo assets and voice capture reliably produces bad reviews and OOM crashes there. Excluding it protects the rating without meaningful install loss.
- **Do not enable Play Integrity exclusion yet.** It silently blocks users on legitimately uncertified devices and on emulators — including the emulators you use for testing. Revisit only if you see subscription or coaching-payment abuse.
- **No SDK-level rule needed.** `minSdkVersion 26` already handles the floor, so an SDK exclusion rule would be redundant.
- **No screen-size rule needed.** Tablets are already handled in the manifest (`resizeableActivity="false"` with the portrait lock), so there is no reason to hard-block large screens from installing.

## Steps in Play Console

1. Device catalogue → Device exclusion rules.
2. On the existing RAM rule, change the value dropdown from `2048 MB` to `1024 MB`.
3. Leave `Android Go devices` on **Exclude**.
4. Do not touch **Play Integrity → Configure**.
5. Save, then check the reported "Devices excluded" count — it should drop to a small number.

## If you prefer a stricter posture

If your priority is protecting the store rating over reach, keep `<= 2048 MB`. That is a valid choice; just be aware it materially reduces reachable devices and cannot be undone retroactively for users who already lost access to updates.
