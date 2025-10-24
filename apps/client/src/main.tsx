import type { PostHogConfig } from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./polyfills.js";
import "./setup-dayjs";

import App from "./App.jsx";
import "./styles/index.css";

const posthogOptions = {
	api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
} satisfies Partial<PostHogConfig>;

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<PostHogProvider apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY} options={posthogOptions}>
			<App />
		</PostHogProvider>
	</StrictMode>,
);
