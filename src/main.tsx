import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import "./lib/firebase"; // Initialize Firebase services

window.__BUILD_FINGERPRINT__ = __BUILD_FINGERPRINT__ ?? "unknown";
console.info("BUILD_FINGERPRINT", window.__BUILD_FINGERPRINT__);

createRoot(document.getElementById("root")!).render(<App />);
