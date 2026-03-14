import dayjs from "dayjs";
import { LucideInfo } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Link } from "~/components/ui/link";

const buildHash = import.meta.env.VITE_BUILD_HASH ?? "dev";

const builtAt = dayjs(import.meta.env.VITE_BUILD_TIMESTAMP);

export function About() {
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button size="icon" variant="on-branding-outline">
					<LucideInfo aria-label="À propos" />
				</Button>
			</DialogTrigger>
			<DialogContent aria-describedby={undefined} className="max-h-dvh overflow-y-auto">
				<DialogHeader>
					<DialogTitle>À propos de Bus Tracker</DialogTitle>
				</DialogHeader>
				<div className="space-y-4 text-center sm:text-left">
					<p>
						Build <code>{buildHash}</code> du {builtAt.format("LLLL")}.
					</p>
					<p>
						Un bug ? Une suggestion ? Une remarque ou une question ?<br />
						Envoyez-moi un e-mail à <Link to="mailto:contact@bus-tracker.fr">contact@bus-tracker.fr</Link> 😉
					</p>

					<div className="space-y-2">
						<p className="text-center">
							<DialogClose asChild>
								<Link to="/help">Aide & FAQ</Link>
							</DialogClose>{" "}
							•{" "}
							<DialogClose asChild>
								<Link to="/legal">Mentions légales</Link>
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
