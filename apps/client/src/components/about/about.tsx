import dayjs from "dayjs";
import { LucideInfo } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Link } from "~/components/ui/link";
import { Separator } from "~/components/ui/separator";

const buildHash = import.meta.env.VITE_BUILD_HASH ?? "dev";

const builtAt = dayjs(import.meta.env.VITE_BUILD_TIMESTAMP);

export function About() {
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button size="icon" variant="branding-outline">
					<LucideInfo aria-label="À propos" />
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>À propos de Bus Tracker</DialogTitle>
				</DialogHeader>
				<p>
					Build <code>{buildHash}</code> du {builtAt.format("LLLL")}.
				</p>
				<p>
					Un bug ? Une suggestion ? Une remarque ou une question ?<br />
					Envoyez-moi un e-mail à <Link to="mailto:contact@bus-tracker.fr">contact@bus-tracker.fr</Link> 😉
				</p>
				<Separator />
				<p className="text-center">
					<Link to="https://kevinbioj.fr" target="_blank">
						kevinbioj.fr <span className="text-xs">(un jour peut-être)</span>
					</Link>{" "}
					•{" "}
					<Link to="https://github.com/kevinbioj/bus-tracker-2" target="_blank">
						GitHub
					</Link>
				</p>
			</DialogContent>
		</Dialog>
	);
}
