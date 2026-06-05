## Replace `FIREBASE_SERVICE_ACCOUNT` with the correct project key

The diagnostic confirmed the backend service account belongs to `carnivore-19bbc`, but iOS tokens are minted under `carnivore-84bd2`. Fix is to swap the secret.

### Steps

1. **Download the correct Admin SDK JSON** from Firebase console:
   - Project: **carnivore-84bd2**
   - Project settings → Service accounts → Firebase Admin SDK → **Generate new private key**
   - Verify the file contains:
     - `"project_id": "carnivore-84bd2"`
     - `"client_email"` ending in `@carnivore-84bd2.iam.gserviceaccount.com`

2. **Verify APNs key uploaded under the same project** (carnivore-84bd2 → Cloud Messaging → Apple app config for `com.mi4labs.carnivorex`).

3. **Update the `FIREBASE_SERVICE_ACCOUNT` secret** — I'll trigger the secure secret-update form. Paste the entire JSON file contents.

4. **Re-test** — Tap "Send test reminder" in iOS. Expected edge log:
   ```
   [fcm] service account project_id= carnivore-84bd2 client_email= …@carnivore-84bd2.iam.gserviceaccount.com
   ```
   Expected response: `{ ok: true, delivered: 1 }` and banner appears.

5. **Remove diagnostic log** from `supabase/functions/_shared/fcm.ts` once verified.

### Out of scope
No client, Android, or schema changes.
