import { createFileRoute } from "@tanstack/react-router";

import { HelpPage } from "~/pages/help";

export const Route = createFileRoute("/_app/help")({
	component: HelpPage,
});
