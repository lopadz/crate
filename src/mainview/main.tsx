import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./rpc"; // Initialize Electroview RPC bridge before React mounts
import { rpcClient } from "./rpc";
import { audioEngine } from "./services/audioEngine";

// Fetch the local HTTP audio server config once at startup (tiny IPC call — just
// returns a URL string and token). audioEngine will use this for all subsequent
// file loads, bypassing the IPC base64 path entirely for large files.
rpcClient?.request
  .fsGetAudioConfig({})
  .then(({ baseUrl, token }) => audioEngine.setServerConfig(baseUrl, token))
  .catch(() => {
    // App continues; audioEngine falls back to legacy IPC base64 path.
  });

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
