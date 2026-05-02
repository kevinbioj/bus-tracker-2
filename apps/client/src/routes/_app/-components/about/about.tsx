import dayjs from "dayjs";
import { LucideInfo } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Link } from "~/components/ui/link";
import * as m from "~/paraglide/messages";

const buildHash = import.meta.env.VITE_BUILD_HASH ?? "dev";

const builtAt = dayjs(import.meta.env.VITE_BUILD_TIMESTAMP);

export function About() {
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button size="icon" variant="on-branding-outline">
					<LucideInfo aria-label={m.about_aria_label()} />
				</Button>
			</DialogTrigger>
			<DialogContent aria-describedby={undefined} className="max-h-[95dvh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{m.about_title()}</DialogTitle>
				</DialogHeader>
				<div className="space-y-4 text-center sm:text-left">
					<p>
						{m.about_build({ buildHash, builtAt: builtAt.format("LLLL") })}
					</p>
					<p>
						{m.about_contact()}
						<br />
						{m.about_contact_email()} <Link to="mailto:contact@bus-tracker.fr">contact@bus-tracker.fr</Link>
					</p>

					<div className="space-y-2">
						<p className="text-center">
							<DialogClose asChild>
								<Link to="/help">{m.about_help()}</Link>
							</DialogClose>{" "}
							•{" "}
							<DialogClose asChild>
								<Link to="/legal">{m.about_legal()}</Link>
							</DialogClose>
						</p>

						<p className="text-center">
							<Link to="https://kevinbioj.fr" target="_blank">
								kevinbioj.fr
							</Link>{" "}
							•{" "}
							<Link to="https://github.com/kevinbioj/bus-tracker-2" target="_blank">
								GitHub
							</Link>{" "}
							•{" "}
							<Link to="https://discord.gg/DpwtEU4qBg" target="_blank">
								Discord
							</Link>
						</p>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
