import { parseAsBoolean, useQueryState } from "nuqs";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import * as m from "~/paraglide/messages";

export function WelcomeBack() {
	const [wasRedirected, setWasRedirected] = useQueryState("from_old", parseAsBoolean.withDefault(false));

	return (
		<Dialog open={wasRedirected} onOpenChange={() => setWasRedirected(null)}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{m.welcome_back_title()}</DialogTitle>
					<DialogDescription>
						{m.welcome_back_intro({ url: "bus-tracker.fr" })}
						<br />
						<br />
						{m.welcome_back_features()}
						<br />
						{m.welcome_back_take_time()}
						<br />
						<br />
						{m.welcome_back_data()}
						<br />
						<br />
						{m.welcome_back_contact()}
					</DialogDescription>
				</DialogHeader>
			</DialogContent>
		</Dialog>
	);
}
