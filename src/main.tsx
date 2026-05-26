import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import "./lib/firebase"; // Initialize Firebase services
import { logAuthDiag } from "./lib/authDiagnostics";

const AUTH_FLOW_VERSION = "v10-persistent-callback-guard";

// Dev-only: never expose build metadata in production builds so no UI path
// can ever pick it up and render a visible badge.
if (import.meta.env.DEV) {
  window.__BUILD_FINGERPRINT__ = __BUILD_FINGERPRINT__ ?? "unknown";
  console.info(
    `[BuildInfo] fingerprint=${window.__BUILD_FINGERPRINT__} ts=${
      typeof __BUILD_TIMESTAMP__ === "string" ? __BUILD_TIMESTAMP__ : "unknown"
    } authFlow=${AUTH_FLOW_VERSION} authVerifyTag=callback:setSession-start`
  );
}

// Production-visible: always recorded in AuthVerify diagnostics so the
// copied log proves which auth-flow build is actually running on device.
logAuthDiag("build:auth-flow", {
  version: AUTH_FLOW_VERSION,
  ts: typeof __BUILD_TIMESTAMP__ === "string" ? __BUILD_TIMESTAMP__ : "unknown",
});

createRoot(document.getElementById("root")!).render(<App />);
