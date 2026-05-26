import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import "./lib/firebase"; // Initialize Firebase services
import { logAuthDiag } from "./lib/authDiagnostics";
import { AUTH_FLOW_BUILD } from "./lib/authFlowBuild";

// Production-visible: always recorded in AuthVerify diagnostics so the
// copied log proves which auth-flow build is actually running on device.
// Logged AS EARLY AS POSSIBLE — before React mounts — so even if the
// callback loop floods the 80-entry buffer afterwards, this entry is
// captured in the persisted localStorage tail at least once per cold start.
logAuthDiag("build:auth-flow", {
  version: AUTH_FLOW_BUILD,
  ts: typeof __BUILD_TIMESTAMP__ === "string" ? __BUILD_TIMESTAMP__ : "unknown",
});

if (import.meta.env.DEV) {
  window.__BUILD_FINGERPRINT__ = __BUILD_FINGERPRINT__ ?? "unknown";
  console.info(
    `[BuildInfo] fingerprint=${window.__BUILD_FINGERPRINT__} ts=${
      typeof __BUILD_TIMESTAMP__ === "string" ? __BUILD_TIMESTAMP__ : "unknown"
    } authFlow=${AUTH_FLOW_BUILD}`
  );
}

createRoot(document.getElementById("root")!).render(<App />);
