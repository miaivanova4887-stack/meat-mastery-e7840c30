# Debug & Harden Push-Tap Deep Linking

Goal: figure out why the app opens but never routes to Profile → Your Coaching. Add temporary diagnostic logs at every hand-off point, and harden the consumer so it cannot lose a tap that arrives before React Router mounts.

## 1. `src/lib/pushFcm.ts` — instrument the producer

In `bindActionListenerOnce()` and the helpers:

- In `pushNotificationActionPerformed`, log the **full** action object and the resolved data dict:
  - `console.info("[PushTap] actionPerformed RAW", JSON.stringify(action))`
  - `console.info("[PushTap] data keys", Object.keys(data), "values", data)`
- In `resolvePushNavPath`, log which branch matched (`path` / `target+session_id` / `url` / null) and the final string.
- In `queuePushNav`, log: `[PushTap] queue path=… sessionStorageWritten=… eventDispatched=…` and whether `window` listener count is known.
- Verify the payload presence explicitly: log `hasPath`, `hasTarget`, `hasSessionId`, `target` value.

Also add a one-shot `console.info("[PushTap] module loaded, listener bind attempted nativePlatform=…")` at module init so we can confirm the module evaluated before the tap (cold-start ordering).

## 2. `src/hooks/usePushNavigation.ts` — instrument & harden the consumer

- Log `[PushNav] consumer mounted` on first effect run.
- Log every drain attempt: `[PushNav] drain module=… stored=…`.
- Log the `push-nav` event handler entry: `[PushNav] event received path=…`.
- Log right before and after `navigate(path)`, plus `window.location.pathname + window.location.search` after a `requestAnimationFrame` tick.

Harden the timing:

- Wrap every `navigate(path)` call (drain + event handler) in `requestAnimationFrame(() => navigate(path))` so it runs after the router has committed its first render.
- Re-check `consumePendingPushNav()` and `sessionStorage` once more on a `setTimeout(…, 0)` after mount, in case `pushFcm.ts` queued the path between module eval and the effect running.
- Keep the existing `push-nav` window event listener; do not remove it.

## 3. `src/lib/pushFcm.ts` — pending-path race fix

Today `queuePushNav` dispatches the `push-nav` event immediately. If the listener hasn't mounted yet (cold start), the event is lost — only `sessionStorage` + module variable survive. That's already in place; we just confirm with logs. No behavior change beyond logs unless the logs prove a different race.

## 4. Payload verification

- Backend already sends `data.path`, `data.target = "coaching_upcoming_session"`, `data.type` for the test reminder (`coaching-reminder-test/index.ts` lines 118–126). `session_id` is intentionally omitted for the test send. No backend changes — but the new logs in step 1 will print the received `data` object so we can confirm FCM/APNs preserved every key end-to-end.

## 5. Test matrix (manual, after rebuild)

For each scenario, capture Xcode console output filtered on `[PushTap]` / `[PushNav]`:

1. **Cold start from locked phone**: kill app → lock → send test → tap notification on lock screen → unlock.
2. **Backgrounded**: open app → home button → send test → tap banner/notification.
3. **Foreground**: app open on any screen → send test → tap the iOS banner.

Expected log sequence in each case:

```text
[PushTap] module loaded …
[PushTap] actionPerformed RAW { … }
[PushTap] data keys ["type","target","path","url"] …
[PushTap] resolved path=/profile?tab=settings&section=coaching branch=path
[PushTap] queue path=… eventDispatched=true
[PushNav] consumer mounted
[PushNav] drain module=/profile?... stored=/profile?...
[PushNav] navigate → /profile?tab=settings&section=coaching
[PushNav] post-nav location=/profile?tab=settings&section=coaching
```

If any line is missing, that pinpoints the failing hand-off.

## 6. Cleanup

Once the path is confirmed, remove the verbose `JSON.stringify(action)` and raw-data logs; keep one concise `[PushTap] actionPerformed path=…` and `[PushNav] navigate path=…` line for ongoing observability.

Approved.

This is the right debugging/hardening plan for the current symptom: app opens, but the push-tap route is lost before React Router consumes it.

I agree with:

full logging in pushNotificationActionPerformed

logging in resolvePushNavPath

logging and verification of queuePushNav

consumer-side mount, drain, event, navigate, and post-nav logs

requestAnimationFrame(() => navigate(path))

post-mount setTimeout(0) re-drain

One implementation guard:

keep one stable push-nav listener only; do not allow duplicate listeners to accumulate if the hook remounts.

Also keep the module-level pending path as the primary cold-start handoff mechanism.

The goal of this pass is to identify exactly which hand-off is failing in:

cold start from lock screen

background tap

foreground banner tap

## Files to change

- `src/lib/pushFcm.ts` — add logs, no behavior change
- `src/hooks/usePushNavigation.ts` — add logs + `requestAnimationFrame` wrap + post-mount `setTimeout(0)` re-drain
- No edge-function changes
- No schema changes