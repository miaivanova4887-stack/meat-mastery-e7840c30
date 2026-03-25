

## Fix Mute Toggle to Stop Ongoing Speech

**File:** `src/components/exercise/YogaFlowProgram.tsx`

Two changes:

### 1. Update mute toggle handler (line 214)
Replace the inline `onClick={() => setMuted((m) => !m)}` with an async handler that calls `TextToSpeech.stop()` when muting:

```typescript
onClick={async () => {
  if (!muted) {
    try { await TextToSpeech.stop(); } catch {}
  }
  setMuted((m) => !m);
}}
```

### 2. Add `muted` to `speak` dependency array (line 42-50