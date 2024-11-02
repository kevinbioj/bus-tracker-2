import dayjs from "dayjs";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.jsx";
import "./index.css";

import relativeTime from "dayjs/plugin/relativeTime.js";

dayjs.extend(relativeTime);

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
