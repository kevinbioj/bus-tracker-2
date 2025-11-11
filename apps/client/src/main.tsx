import { posthog } from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./polyfills.js";
import "./setup-dayjs";

import App from "./App.jsx";
import "./styles/index.css";

if (import.meta.env.VITE_PUBLIC_POSTHOG_KEY !== undefined) {
	posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_KEY, {
		api_host: import.meta.env.VITE_PUBLIC_POSTHOG_API_HOST,
		autocapture: false,
		capture_exceptions: true,
		defaults: "2025-05-24",
		respect_dnt: true,
		ui_host: import.meta.env.VITE_PUBLIC_POSTHOG_UI_HOST,
	});
}

posthog.register({
	build_hash: import.meta.env.VITE_BUILD_HASH,
	build_timestamp: import.meta.env.VITE_BUILD_TIMESTAMP,
});

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<PostHogProvider client={posthog}>
			<App />
		</PostHogProvider>
	</StrictMode>,
);
