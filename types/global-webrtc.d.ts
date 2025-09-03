// Ambient helpers for debugging instrumentation injected by useWebRTC
// This file declares optional properties used only in debug flows.

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Window {
  __peers?: Record<string, RTCPeerConnection>;
}

export {};
