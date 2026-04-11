/// <reference types="vite/client" />

declare const __BUILD_TIMESTAMP__: string | undefined;
declare const __BUILD_FINGERPRINT__: string | undefined;

interface Window {
  __BUILD_FINGERPRINT__?: string;
}
