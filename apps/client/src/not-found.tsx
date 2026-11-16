import { Link } from "@tanstack/react-router";

import { NoIndex } from "~/components/seo";
import { Button } from "~/components/ui/button";
import * as m from "~/paraglide/messages";
import { NavigationBar } from "~/routes/_app/-components/navigation-bar";

export function NotFound() {
	return (
		<>
			<title>{m.not_found_page_title()}</title>
			<NoIndex />
			<NavigationBar />
			<main className="mx-auto flex w-full max-w-(--breakpoint-xl) flex-col items-start gap-2 p-3">
				<h1 className="text-2xl font-bold">{m.not_found_title()}</h1>
				<p className="text-muted-foreground">{m.not_found_description()}</p>
				<Button
					className="mt-2"
					nativeButton={false}
					render={<Link to="/">{m.not_found_back_home()}</Link>}
					variant="branding-default"
				/>
			</main>
		</>
	);
}
