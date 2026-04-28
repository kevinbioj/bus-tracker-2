import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "~/pages/legal";

export const Route = createFileRoute("/_app/legal")({
	component: LegalPage,
});
