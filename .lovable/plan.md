# Sign in with Apple (iOS) — Investigation & Fix Plan

## What I found

**1. Missing entitlement** — `ios/App/App/App.entitlements` only has `com.apple.developer.healthkit`. The required key `com.apple.developer.applesignin` (value `<array><string>Default</string></array>`) is **not present**. Without it, iOS cannot grant the Apple ID credential and App Store review rejects native Apple sign-in.

**2. Bundle ID** — `capacitor.config.json` → `appId = com.mi4labs.carnivorex`. This is the iOS Bundle ID and must match the App ID registered in the Apple Developer portal that has the "Sign In with Apple" capability enabled.

**3. Current implementation is web-OAuth-only, not native** — `src/pages/Auth.tsx` (handleOAuthSignIn, line 115) calls `supabase.auth.signInWithOAuth({ provider: "apple" })` then opens the URL with `@capacitor/browser` to a `carnivorex://callback` deep link. There is **no `@capacitor-community/apple-sign-in**` package installed (not in `package.json`) and no native ASAuthorizationAppleIDProvider call. On iOS this approach:

- Violates App Store Guideline 4.8 (must use native ASAuthorization on iOS when offering Apple sign-in).
- Depends on a fully-configured Services ID + private key on the Supabase side, not the iOS Bundle App ID.
- Will silently fail or loop if the `carnivorex://` scheme isn't whitelisted in Supabase Redirect URLs **and** if Apple's web Services ID Return URL doesn't include `https://gueosugzlebbaijzcxgh.supabase.co/auth/v1/callback`.

**4. Supabase Apple provider config** is not visible from code — it lives in the dashboard and must be verified manually.

**5. No exact error captured yet** — `logAuthDiag` writes to console; we need a device log capture (`oauth:signIn-result` / `oauth:browser-open` / `oauth:signIn-threw`) from a real run to know whether failure is at signInWithOAuth, at Browser.open, at Apple's page, or at the deep-link return.

## Plan — switch iOS to the native Apple plugin (recommended)

### Step 1 — Add Apple Sign-In entitlement

Edit `ios/App/App/App.entitlements` to add:

```xml
<key>com.apple.developer.applesignin</key>
<array><string>Default</string></array>
```

Then in Xcode: Target → Signing & Capabilities → **+ Capability → Sign In with Apple** (this also updates the provisioning profile on Apple's side; user must do this once locally and re-archive).

### Step 2 — Install native plugin

Add `@capacitor-community/apple-sign-in` to `package.json`, run `npx cap sync ios`.

### Step 3 — Rewrite the iOS branch of `handleOAuthSignIn`

In `src/pages/Auth.tsx`:

- On `platform === "ios"`, call `SignInWithApple.authorize({ clientId: <Services ID>, redirectURI: "https://gueosugzlebbaijzcxgh.supabase.co/auth/v1/callback", scopes: "email name", state: <nonce>, nonce: <sha256(nonce)> })`.
- Take the returned `identityToken` and call `supabase.auth.signInWithIdToken({ provider: "apple", token: identityToken, nonce: <raw nonce> })`. This is the **only** flow that satisfies Apple's native requirement and avoids the Browser/deep-link round-trip entirely.
- Keep the current web-OAuth path for Android & web.

### Step 4 — Verify Apple Developer portal configuration

The user must confirm in [https://developer.apple.com/account](https://developer.apple.com/account):

- **App ID** `com.mi4labs.carnivorex` → Capabilities → **Sign In with Apple = Enabled**, and provisioning profile regenerated & downloaded.
- **Services ID** (e.g. `com.mi4labs.carnivorex.web`) → Sign In with Apple → Configure:
  - Primary App ID = `com.mi4labs.carnivorex`
  - Domain = `gueosugzlebbaijzcxgh.supabase.co`
  - **Return URL** = `https://gueosugzlebbaijzcxgh.supabase.co/auth/v1/callback` (exact, no trailing slash)
- **Key (.p8)** with Sign In with Apple enabled — note the 10-char Key ID and Team ID.

### Step 5 — Verify Supabase Apple provider config

In the backend dashboard → Authentication → Providers → Apple:

- **Client IDs** = both the iOS Bundle ID `com.mi4labs.carnivorex` **and** the Services ID (comma-separated). The Bundle ID is required for `signInWithIdToken` to validate the native iOS audience claim.
- **Secret Key (for OAuth)** = JWT generated from Team ID + Key ID + .p8 (only needed for the web flow; native id_token flow doesn't need it).
- Authentication → URL Configuration → Redirect URLs must include `carnivorex://callback` (kept for the Android web-OAuth path).

### Step 6 — Capture the current error before/after

Ask the user to:

- Plug in the device, run `idevicesyslog | grep -iE "AuthVerify|oauth:|apple"` (or Console.app filtered to the app), reproduce the tap, and paste output. This pinpoints whether today's failure is at Supabase (`error.message`), at Browser open, at Apple's web page, or at the deep-link return.
- Pull Supabase auth logs filtered to `provider=apple` for the same minute.

## Files that will change

- `ios/App/App/App.entitlements` — add applesignin key
- `package.json` — add `@capacitor-community/apple-sign-in`
- `src/pages/Auth.tsx` — add native iOS branch in `handleOAuthSignIn`, calling `SignInWithApple.authorize` + `supabase.auth.signInWithIdToken`
- `ios/App/Podfile.lock` & `ios/App/App.xcodeproj/project.pbxproj` — regenerated by `npx cap sync ios` and by enabling the capability in Xcode (user does this locally)

## Open questions for you

1. Do you already have a **Services ID** registered (separate from the Bundle ID) and a **.p8 key** uploaded to Supabase? If not, we need to create them before any flow can work.
2. Can you grab a fresh device console log (`oauth:*` lines) from one failed tap so we can confirm the exact failure point before changing code?
3. Are you OK with adding the native plugin (Apple's requirement for App Store), or do you want to keep the pure-web OAuth flow on iOS for now (knowing it will be rejected at review)?

Approved with one adjustment: proceed with the native iOS Apple Sign-In implementation using entitlement + native plugin + Supabase signInWithIdToken().

But please clearly separate what is required for:

native iOS Apple Sign-In using the app bundle ID, and

web OAuth Apple Sign-In using a Services ID.

I want the implementation optimized for native iOS first.

Please proceed with:

adding the Apple Sign-In entitlement,

adding the Capacitor Apple Sign-In plugin,

rewriting the iOS auth branch to use native Apple credential → supabase.auth.signInWithIdToken(),

keeping existing web/Android OAuth paths unchanged unless necessary.

Then return:

exact files changed,

whether a Services ID is strictly needed for the native iOS flow in this project,

and the exact Apple Developer + Supabase dashboard settings I must configure manually.

&nbsp;

Could not create a sandbox extension for '/var/containers/Bundle/Application/B3B921F4-15A4-4D13-9023-89AC33DDF49B/[App.app](http://App.app)'

⚡️ NativeSettings - Plugin loaded

⚡️  Loading app at capacitor://localhost...

WebContent[9046] 0x20000014235c008 - [webPageID=8] WebPage::runJavaScriptInFrameInScriptWorld: Request to run JavaScript failed with error <private>

⚡️  JS Eval error A JavaScript exception occurred

WebContent[9046] Unable to hide query parameters from script (missing data)

⚡️  [info] - 🌐 i18next is made possible by our own product, Locize — consider powering your project with managed localization (AI, CDN, integrations): [https://locize.com](https://locize.com) 💙

⚡️  [info] - [Index] gate: onboardingComplete= false

⚡️  [info] - [PushDecision] source=shell branch=mount {"source":"shell","appStartAt":1779762169475,"elapsed":36,"delayMs":90000,"remaining":89964}

⚡️  [info] - [PushDecision] source=shell branch=suppress reason=not-android (mount)

⚡️  [info] - [HealthConnect] mount native= true cachedConnected= false

⚡️  To Native ->  App addListener 127462728

⚡️  To Native ->  App getLaunchUrl 127462729

⚡️  To Native ->  App addListener 127462730

⚡️  To Native ->  App addListener 127462731

⚡️  To Native ->  HealthConnect checkAvailability 127462732

⚡️  TO JS undefined

⚡️  To Native ->  Purchases setLogLevel -1

⚡️  To Native ->  Purchases configure -1

⚡️  TO JS {"status":"available"}

⚡️  To Native ->  App addListener 127462733

⚡️  To Native ->  Purchases logOut 127462734

⚡️  TO JS undefined

⚡️  To Native ->  App addListener 127462735

⚡️  To Native ->  App getLaunchUrl 127462736

⚡️  To Native ->  App addListener 127462737

⚡️  To Native ->  App addListener 127462738

⚡️  To Native ->  App removeListener 127462739

⚡️  To Native ->  App removeListener 127462740

⚡️  To Native ->  App removeListener 127462741

⚡️  TO JS undefined

⚡️  [info] - [revenuecat] configured {"platform":"ios","keyPrefix":"appl_gyn","appUserId":"(anonymous)"}

⚡️  [info] - [AuthVerify] deeplink:launch-url-empty {}

⚡️  [info] - [HealthConnect] availability status= available

⚡️  [info] - [Onboarding] mount native= true completeFlag= null legacyFlag= true

⚡️  TO JS undefined

INFO: ℹ️ Log out called for user

⚡️  [info] - [AuthVerify] deeplink:launch-url-empty {}

INFO: ℹ️ Log out successful

WebContent[9046] xpc_user_sessions_get_foreground_uid() failed with error 1 - Operation not permitted

⚡️  WebView loaded

⚡️  [error] - {"__isAuthError":true,"name":"AuthApiError","status":400,"code":"refresh_token_not_found"}

⚡️  TO JS {"customerInfo":{"allPurchaseDatesMillis":{},"allExpirationDatesMillis":{},"originalAppUserId":"$RCAnonymousID:75019e0d6d994a59992367260b1b4844","subscriptionsByProductIdentifier":{},"entitlements":{"all":{},"active":{},"verification":"VERIFIED"},"requestD

ERROR: 🍎‼️ Error fetching offerings - The operation couldn’t be completed. (RevenueCat.OfferingsManager.Error error 1.)

There's a problem with your configuration. None of the products registered in the RevenueCat dashboard could be fetched from App Store Connect (or the StoreKit Configuration file if one is being used). 

More information: [https://rev.cat/why-are-offerings-empty](https://rev.cat/why-are-offerings-empty)

autoVacuumModeStatus: Running PRAGMA auto_vacuum query to get vacuum mode

⚡️  TO JS undefined

⚡️  TO JS undefined

⚡️  To Native ->  HealthConnect checkAvailability 127462742

⚡️  TO JS {"status":"available"}

⚡️  [info] - [AuthVerify] deeplink:resume-refresh {}

⚡️  [info] - [HealthConnect] availability status= available

⚡️  [info] - [AuthVerify] deeplink:resume-refresh-error {"message":"Auth session missing!"}

ERROR: 🍎‼️ Error fetching offerings - The operation couldn’t be completed. (RevenueCat.OfferingsManager.Error error 1.)

There's a problem with your configuration. None of the products registered in the RevenueCat dashboard could be fetched from App Store Connect (or the StoreKit Configuration file if one is being used). 

More information: [https://rev.cat/why-are-offerings-empty](https://rev.cat/why-are-offerings-empty)

INFO: ℹ️ Marking attributes as synced for App User ID: $RCAnonymousID:75019e0d6d994a59992367260b1b4844:

 attributes: ["$attConsentStatus": [SubscriberAttribute] key: $attConsentStatus value: notDetermined setTime: 2026-05-26 02:24:14 +0000]

Unable to simultaneously satisfy constraints.

Probably at least one of the constraints in the following list is one you don't want. 

Try this: 

(1) look at each constraint and try to figure out which you don't expect; 

(2) find the code that added the unwanted constraint or constraints and fix it. 

(

    "<NSLayoutConstraint:0x1299cf750 *TtC5UIKitP33*DDE14AA6B49FCAFC5A54255A118E1D8713ButtonWrapper:0x129901800.width == _UIButtonBarButton:0x1299b4780.width   (active)>",

    "<NSLayoutConstraint:0x1299cf890 'IB_Leading_Leading' H:|-(8)-[_UIModernBarButton:0x129932d80]   (active, names: '|':_UIButtonBarButton:0x1299b4780 )>",

    "<NSLayoutConstraint:0x1299cf8e0 'IB_Trailing_Trailing' H:[_UIModernBarButton:0x129932d80]-(8)-|   (active, names: '|':_UIButtonBarButton:0x1299b4780 )>",

    "<NSLayoutConstraint:0x1299cfe30 'UIView-Encapsulated-Layout-Width' *TtC5UIKitP33*DDE14AA6B49FCAFC5A54255A118E1D8713ButtonWrapper:0x129901800.width == 0   (active)>"

)

&nbsp;

Will attempt to recover by breaking constraint 

<NSLayoutConstraint:0x1299cf8e0 'IB_Trailing_Trailing' H:[_UIModernBarButton:0x129932d80]-(8)-|   (active, names: '|':_UIButtonBarButton:0x1299b4780 )>

&nbsp;

Make a symbolic breakpoint at UIViewAlertForUnsatisfiableConstraints to catch this in the debugger.

The methods in the UIConstraintBasedLayoutDebugging category on UIView listed in <UIKitCore/UIView.h> may also be helpful.

Unable to simultaneously satisfy constraints.

Probably at least one of the constraints in the following list is one you don't want. 

Try this: 

(1) look at each constraint and try to figure out which you don't expect; 

(2) find the code that added the unwanted constraint or constraints and fix it. 

(

    "<NSLayoutConstraint:0x1298db2a0 *TtC5UIKitP33*DDE14AA6B49FCAFC5A54255A118E1D8713ButtonWrapper:0x129901c00.width == _UIButtonBarButton:0x1299b4c80.width   (active)>",

    "<NSLayoutConstraint:0x1298db480 'IB_Leading_Leading' H:|-(8)-[_UIModernBarButton:0x129933100]   (active, names: '|':_UIButtonBarButton:0x1299b4c80 )>",

    "<NSLayoutConstraint:0x1298db4d0 'IB_Trailing_Trailing' H:[_UIModernBarButton:0x129933100]-(8)-|   (active, names: '|':_UIButtonBarButton:0x1299b4c80 )>",

    "<NSLayoutConstraint:0x129aec0a0 'UIView-Encapsulated-Layout-Width' *TtC5UIKitP33*DDE14AA6B49FCAFC5A54255A118E1D8713ButtonWrapper:0x129901c00.width == 0   (active)>"

)

&nbsp;

Will attempt to recover by breaking constraint 

<NSLayoutConstraint:0x1298db4d0 'IB_Trailing_Trailing' H:[_UIModernBarButton:0x129933100]-(8)-|   (active, names: '|':_UIButtonBarButton:0x1299b4c80 )>

&nbsp;

Make a symbolic breakpoint at UIViewAlertForUnsatisfiableConstraints to catch this in the debugger.

The methods in the UIConstraintBasedLayoutDebugging category on UIView listed in <UIKitCore/UIView.h> may also be helpful.

Unable to simultaneously satisfy constraints.

Probably at least one of the constraints in the following list is one you don't want. 

Try this: 

(1) look at each constraint and try to figure out which you don't expect; 

(2) find the code that added the unwanted constraint or constraints and fix it. 

(

    "<NSLayoutConstraint:0x129aec4b0 *TtC5UIKitP33*DDE14AA6B49FCAFC5A54255A118E1D8713ButtonWrapper:0x129902000.width == _UIButtonBarButton:0x1299b5180.width   (active)>",

    "<NSLayoutConstraint:0x129aec5a0 'IB_Leading_Leading' H:|-(8)-[_UIModernBarButton:0x129933480]   (active, names: '|':_UIButtonBarButton:0x1299b5180 )>",

    "<NSLayoutConstraint:0x129aec5f0 'IB_Trailing_Trailing' H:[_UIModernBarButton:0x129933480]-(8)-|   (active, names: '|':_UIButtonBarButton:0x1299b5180 )>",

    "<NSLayoutConstraint:0x129aecaa0 'UIView-Encapsulated-Layout-Width' *TtC5UIKitP33*DDE14AA6B49FCAFC5A54255A118E1D8713ButtonWrapper:0x129902000.width == 0   (active)>"

)

&nbsp;

Will attempt to recover by breaking constraint 

<NSLayoutConstraint:0x129aec5f0 'IB_Trailing_Trailing' H:[_UIModernBarButton:0x129933480]-(8)-|   (active, names: '|':_UIButtonBarButton:0x1299b5180 )>

&nbsp;

Make a symbolic breakpoint at UIViewAlertForUnsatisfiableConstraints to catch this in the debugger.

The methods in the UIConstraintBasedLayoutDebugging category on UIView listed in <UIKitCore/UIView.h> may also be helpful.

-[RTIInputSystemClient remoteTextInputSessionWithID:textSuggestionsChanged:]  Can only set suggestions for an active session. sessionID = C1BC03A5-1982-4E1D-A964-54E808EC843D

⚡️  [info] - [Onboarding] step11 done — native= true android= false → next= push audit

⚡️  [info] - [PushDecision] source=onboarding branch=suppress reason=not-android native=true platform=ios

⚡️  [info] - [Index] gate: onboardingComplete= true

⚡️  To Native ->  App addListener 127462743

⚡️  To Native ->  App getLaunchUrl 127462744

⚡️  To Native ->  App addListener 127462745

⚡️  To Native ->  App addListener 127462746

⚡️  TO JS ⚡️  To Native ->  App removeListener 127462747

undefined

⚡️  To Native ->  App removeListener 127462748

⚡️  To Native ->  App removeListener 127462749

⚡️  [info] - [AuthVerify] deeplink:launch-url-empty {}

⚡️  To Native ->  HealthConnect checkAvailability 127462750

⚡️  TO JS {"status":"available"}

⚡️  To Native ->  HealthConnect requestPermissions 127462751

⚡️  TO JS {"granted":true,"grantedCount":4}

⚡️  [info] - [HealthConnect] requestPermissions → granted= true

⚡️  To Native ->  HealthConnect readSteps 127462752

⚡️  TO JS {"records":[{"value":7932,"unit":"steps","timestamp":"2026-05-26T02:25:01.772Z"}]}

⚡️  To Native ->  HealthConnect readHeartRate 127462753

⚡️  TO JS {"records":[]}

⚡️  [info] - [HealthConnect] mount native= true cachedConnected= true

⚡️  To Native ->  HealthConnect checkAvailability 127462754

⚡️  TO JS {"status":"available"}

⚡️  To Native ->  App removeListener 127462755

⚡️  To Native ->  App addListener 127462756

⚡️  To Native ->  HealthConnect readWeight 127462757

⚡️  [info] - [HealthConnect] availability status= available

⚡️  TO JS {"records":[{"timestamp":"2026-04-18T00:22:36.897Z","unit":"kg","value":54}]}

⚡️  To Native ->  HealthConnect readActiveCalories 127462758

⚡️  [info] - [HealthConnectContext] weight build=v3 latest=54kg records=1 ts=2026-04-18T00:22:36.897Z

⚡️  TO JS {"records":[{"value":153.63900000000004,"unit":"kcal","timestamp":"2026-05-26T02:25:01.772Z"}]}

⚡️  To Native ->  App addListener 127462759

⚡️  To Native ->  App getLaunchUrl 127462760

⚡️  To Native ->  App addListener 127462761

⚡️  To Native ->  App addListener 127462762

⚡️  To Native ->  App removeListener 127462763

⚡️  To Native ->  App removeListener 127462764

⚡️  TO JS undefined

⚡️  To Native ->  App removeListener 127462765

⚡️  [info] - [AuthVerify] deeplink:launch-url-empty {}

WebContent[9046] makeImagePlus:3799: *** ERROR: 'WEBP'-_reader->initImage[0] failed err=-50

⚡️  To Native ->  App addListener 127462766

⚡️  To Native ->  App getLaunchUrl 127462767

⚡️  To Native ->  App addListener 127462768

⚡️  To Native ->  App addListener 127462769

⚡️  To Native ->  App removeListener 127462770

⚡️  To Native ->  App removeListener 127462771

⚡️  To Native ->  App removeListener 127462772

⚡️  TO JS undefined

⚡️  [info] - [AuthVerify] deeplink:launch-url-empty {}

⚡️  [info] - [AuthVerify] oauth:click {"provider":"apple","platform":"ios","isNative":true}

⚡️  [info] - [AuthVerify] oauth:redirect-uri {"redirectTo":"carnivorex://callback"}

⚡️  [info] - [AuthVerify] oauth:signIn-result {"provider":"apple","flow":"native-manual","hasUrl":true,"hasError":false,"errName":null,"errMessage":null}

⚡️  [info] - [AuthVerify] oauth:browser-open {"url":"[https://gueosugzlebbaijzcxgh.supabase.co/auth/v1/authorize?provider=apple&redirect_to=carnivorex%3A%2F%2Fcallback](https://gueosugzlebbaijzcxgh.supabase.co/auth/v1/authorize?provider=apple&redirect_to=carnivorex%3A%2F%2Fcallback)"}

⚡️  To Native ->  Browser open 127462773

-[RTIInputSystemClient remoteTextInputSessionWithID:performInputOperation:]  perform input operation requires a valid sessionID. inputModality = Keyboard, inputOperation = <null selector>, customInfoType = UIEmojiSearchOperations

(501) Invalidation handler invoked, clearing connection

(501) personaAttributesForPersonaType for type:0 failed with error Error Domain=NSCocoaErrorDomain Code=4099 "The connection to service named [com.apple.mobile](http://com.apple.mobile).usermanagerd.xpc was invalidated from this process." UserInfo={NSDebugDescription=The connection to service named [com.apple.mobile](http://com.apple.mobile).usermanagerd.xpc was invalidated from this process.}

Received port for identifier response: <(null)> with error:Error Domain=RBSServiceErrorDomain Code=1 "Client not entitled" UserInfo={RBSEntitlement=[com.apple](http://com.apple).runningboard.process-state, NSLocalizedFailureReason=Client not entitled, RBSPermanent=false}

elapsedCPUTimeForFrontBoard couldn't generate a task port

Received port for identifier response: <(null)> with error:Error Domain=RBSServiceErrorDomain Code=1 "Client not entitled" UserInfo={RBSEntitlement=[com.apple](http://com.apple).runningboard.process-state, NSLocalizedFailureReason=Client not entitled, RBSPermanent=false}

elapsedCPUTimeForFrontBoard couldn't generate a task port

Received port for identifier response: <(null)> with error:Error Domain=RBSServiceErrorDomain Code=1 "Client not entitled" UserInfo={RBSEntitlement=[com.apple](http://com.apple).runningboard.process-state, NSLocalizedFailureReason=Client not entitled, RBSPermanent=false}

elapsedCPUTimeForFrontBoard couldn't generate a task port

Received port for identifier response: <(null)> with error:Error Domain=RBSServiceErrorDomain Code=1 "Client not entitled" UserInfo={RBSEntitlement=[com.apple](http://com.apple).runningboard.process-state, NSLocalizedFailureReason=Client not entitled, RBSPermanent=false}

elapsedCPUTimeForFrontBoard couldn't generate a task port

-[RTIInputSystemClient remoteTextInputSessionWithID:performInputOperation:]  perform input operation requires a valid sessionID. inputModality = Keyboard, inputOperation = <null selector>, customInfoType = UIEmojiSearchOperations

⚡️  TO JS undefined

-[RTIInputSystemClient remoteTextInputSessionWithID:performInputOperation:]  perform input operation requires a valid sessionID. inputModality = Keyboard, inputOperation = <null selector>, customInfoType = UIEmojiSearchOperations

-[RTIInputSystemClient remoteTextInputSessionWithID:performInputOperation:]  perform input operation requires a valid sessionID. inputModality = Keyboard, inputOperation = <null selector>, customInfoType = UIEmojiSearchOperations

-[RTIInputSystemClient remoteTextInputSessionWithID:performInputOperation:]  perform input operation requires a valid sessionID. inputModality = Keyboard, inputOperation = <null selector>, customInfoType = UIEmojiSearchOperations

-[RTIInputSystemClient remoteTextInputSessionWithID:performInputOperation:]  perform input operation requires a valid sessionID. inputModality = Keyboard, inputOperation = <null selector>, customInfoType = UIEmojiSearchOperations

-[RTIInputSystemClient remoteTextInputSessionWithID:performInputOperation:]  perform input operation requires a valid sessionID. inputModality = Keyboard, inputOperation = <null selector>, customInfoType = UIEmojiSearchOperations

-[RTIInputSystemClient remoteTextInputSessionWithID:performInputOperation:]  perform input operation requires a valid sessionID. inputModality = Keyboard, inputOperation = <null selector>, customInfoType = UIEmojiSearchOperations

-[RTIInputSystemClient remoteTextInputSessionWithID:textSuggestionsChanged:]  Can only set suggestions for an active session. sessionID = 7221885E-7BB3-4A04-A632-40A26C027C02

-[RTIInputSystemClient remoteTextInputSessionWithID:performInputOperation:]  perform input operation requires a valid sessionID. inputModality = Keyboard, inputOperation = <null selector>, customInfoType = UIEmojiSearchOperations

-[RTIInputSystemClient remoteTextInputSessionWithID:performInputOperation:]  perform input operation requires a valid sessionID. inputModality = Keyboard, inputOperation = <null selector>, customInfoType = UIEmojiSearchOperations

-[RTIInputSystemClient remoteTextInputSessionWithID:performInputOperation:]  perform input operation requires a valid sessionID. inputModality = Keyboard, inputOperation = dismissAutoFillPanel, customInfoType = UIUserInteractionRemoteInputOperations

-[RTIInputSystemClient remoteTextInputSessionWithID:performInputOperation:]  perform input operation requires a valid sessionID. inputModality = Keyboard, inputOperation = dismissAutoFillPanel, customInfoType = UIUserInteractionRemoteInputOperations

-[RTIInputSystemClient remoteTextInputSessionWithID:performInputOperation:]  perform input operation requires a valid sessionID. inputModality = Keyboard, inputOperation = dismissAutoFillPanel, customInfoType = UIUserInteractionRemoteInputOperations

[C:3] Error received: Connection interrupted.

[C:3-1] Error received: Connection interrupted.

-[RTIInputSystemClient *configureConnection:withMachName:]*block_invoke  Client connection to service was interrupted: <NSXPCConnection: 0x129908000> connection to service with pid -1 named (null)

Snapshotting a view (0x11d15f400, UIKeyboardImpl) that is not in a visible window requires afterScreenUpdates:YES.