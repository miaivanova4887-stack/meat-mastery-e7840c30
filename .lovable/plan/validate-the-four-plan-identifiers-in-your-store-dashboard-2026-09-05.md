# Validate the four plan identifiers in your store dashboard

Goal: confirm that `prodf562b53729`, `prodc525201a85`, `prod54e0236b00`, `prod63a34539bb` are the four subscription plans (Pro monthly/yearly, Elite monthly/yearly) and that each one carries a Google Play base plan — the missing piece that makes the app show "Unavailable".

## What we already know

The last live query of your store account returned a current "default" offering with four plans named `pro_monthly`, `pro_yearly`, `elite_monthly`, `elite_yearly`, and none of them came back with a base plan attached. Google Play cannot price a subscription without its base plan, so the app drops it and the plan card reads "Unavailable".

## Step 1 — save a store API key (you)

I need a read-capable secret key for your store dashboard's v2 API. In RevenueCat: Project Settings, API keys, create a **secret** v2 key (starts with `sk_`) with read access to products, then save it here when I open the secure form. It is stored encrypted and never printed back.

## Step 2 — look up each identifier (me)

For each of the four IDs I fetch the product record and report a small table:

- which of the four plans it is
- the exact store product identifier as the store has it
- whether a base plan is present (the part after the colon)
- store (Play / App Store) and app it belongs to

## Step 3 — say plainly what is wrong and what to fix

Expected healthy result for Play: identifiers shaped `pro_monthly:pro-monthly`, `elite_yearly:elite-yearly`, etc.

- If base plans are missing here too, the fix is in the store dashboard: attach each plan's active base plan to its product, then re-add the four products to the "default" offering. No app rebuild needed — prices appear on next app open.
- If the identifiers look correct in the dashboard but the app still returned them bare, the fault is on the Play Console side (base plan not active, or the product not available in your tester's country) and I'll name the exact plan to activate.
- If any ID points at a different app, project, or a one-off product (for example the coaching call), I'll flag it as mismatched and give you the correct one.

## Step 4 — confirm on device

After the dashboard fix you reinstall from the internal track, open Choose Your Plan, and prices should render. I re-query to confirm the four products now carry base plans. No code change is expected in this task.

## Technical notes

- API: `GET https://api.revenuecat.com/v2/projects/{project_id}/products/{product_id}` per identifier, plus `GET /v2/projects/{project_id}/offerings` with packages expanded to confirm attachment.
- Secret name: `REVENUECAT_V2_SECRET_KEY`, used only for these read-only diagnostic queries from the agent side; it is not referenced by app or backend code.
- App-side mapping stays as-is: `src/lib/revenuecat.ts` resolves packages `pro_monthly` / `pro_yearly` / `elite_monthly` / `elite_yearly` from the current offering; entitlements `pro` and `elite`.
