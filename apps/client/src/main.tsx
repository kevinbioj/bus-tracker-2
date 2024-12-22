import * as Sentry from "@sentry/react";
import dayjs from "dayjs";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./setup-dayjs.js";

import App from "./App.jsx";
import "./styles/index.css";

import relativeTime from "dayjs/plugin/relativeTime.js";

if (import.meta.env.PROD) {
	Sentry.init({
		dsn: "https://111a5d771b7db84170a379cea2023fa1@o4507544469176320.ingest.de.sentry.io/4508479587549264",
		integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
		tracesSampleRate: 1.0,
		tracePropagationTargets: [/^https:\/\/dev\.bus-tracker\.fr\/api/],
		replaysSessionSampleRate: 0.3,
		replaysOnErrorSampleRate: 1.0,
	});
}

dayjs.extend(relativeTime);

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
