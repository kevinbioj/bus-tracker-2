import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./polyfills.js";
import "./setup-paraglide";
import "./setup-dayjs";

import { loadPostHog } from "./utils/posthog";

history.scrollRestoration = "manual";

window.addEventListener("vite:preloadError", () => {
	window.location.reload();
});

import App from "./App.jsx";
import "maplibre-gl/dist/maplibre-gl.css";
import "leaflet/dist/leaflet.css";
import "vis-timeline/styles/vis-timeline-graph2d.min.css";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);

if ("requestIdleCallback" in window) {
	requestIdleCallback(() => void loadPostHog(), { timeout: 3000 });
} else {
	setTimeout(() => void loadPostHog(), 1500);
}
