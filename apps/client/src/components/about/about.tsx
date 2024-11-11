import dayjs from "dayjs";
import { LucideInfo } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Separator } from "~/components/ui/separator";

const buildHash = import.meta.env.BUILD_HASH ?? "dev";

const builtAt = dayjs(import.meta.env.BUILD_TIMESTAMP);

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
				<Separator />
				<p>
					Un bug ? Une suggestion ? Une remarque ou une question ?<br />
					Envoyez-moi un e-mail à{" "}
					<Link className="transition-colors hover:text-foreground/70" to="mailto:contact@bus-tracker.fr">
						contact@bus-tracker.fr
					</Link>{" "}
					😉
				</p>
			</DialogContent>
		</Dialog>
	);
}
