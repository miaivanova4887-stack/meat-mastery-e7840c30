import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import "./lib/firebase"; // Initialize Firebase services

window.__BUILD_FINGERPRINT__ = __BUILD_FINGERPRINT__ ?? "unknown";
// Single-string log so Capacitor's WebView bridge writes it intact to logcat.
// Grep target: `adb logcat | grep BuildInfo`
console.info(
  `[BuildInfo] fingerprint=${window.__BUILD_FINGERPRINT__} ts=${
    typeof __BUILD_TIMESTAMP__ === "string" ? __BUILD_TIMESTAMP__ : "unknown"
  } authFlow=v2-verifyOtp authVerifyTag=callback:verifyOtp-call`
);

createRoot(document.getElementById("root")!).render(<App />);
