import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./rpc"; // Initialize Electroview RPC bridge before React mounts
import App from "./App";

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
