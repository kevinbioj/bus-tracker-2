import * as Sentry from "@sentry/react";
import dayjs from "dayjs";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./setup-dayjs";

import App from "./App.jsx";
import "./styles/index.css";

import relativeTime from "dayjs/plugin/relativeTime";

if (import.meta.env.PROD) {
	Sentry.init({
		dsn: "https://111a5d771b7db84170a379cea2023fa1@o4507544469176320.ingest.de.sentry.io/4508479587549264",
		integrations: [Sentry.browserTracingIntegration()],
		tracesSampleRate: 0.3,
		tracePropagationTargets: [/^https:\/\/(?:www\.)?bus-tracker\.fr\/api/],
	});
}

dayjs.extend(relativeTime);

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
