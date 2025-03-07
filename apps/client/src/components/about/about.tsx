import dayjs from "dayjs";
import { BusFrontIcon, LucideInfo, SatelliteDishIcon } from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Link } from "~/components/ui/link";
import { Separator } from "~/components/ui/separator";

const buildHash = import.meta.env.VITE_BUILD_HASH ?? "dev";

const builtAt = dayjs(import.meta.env.VITE_BUILD_TIMESTAMP);

const qanda = [
	{
		question: "Que signifie la couleur du satellite ?",
		answer: (
			<>
				<p className="mb-3">
					<SatelliteDishIcon className="inline align-middle mr-1" color="#38A169" /> Position GPS fournie par
					l'opérateur de transport.
				</p>
				<p className="mb-3">
					<SatelliteDishIcon className="inline align-middle mr-1" color="#DD6B20" /> Position déterminée grâce aux
					horaires temps-réel.
				</p>
				<p>
					<SatelliteDishIcon className="inline align-middle mr-1" color="#E53E3E" /> Position théorique du véhicule
					(temps-réel indisponible).
				</p>
			</>
		),
	},
	{
		question: "Où se trouve le tableau des véhicules en ligne ?",
		answer: (
			<p>
				Appuyez sur l'icône{" "}
				<BusFrontIcon className="align-text-bottom border border-black dark:border-white inline p-0.5 pl-[3px]" />{" "}
				présente sous les contrôles de zoom de la carte.
			</p>
		),
	},
	{
		question: "J'ai une question à propos de l'application",
		answer: (
			<p>
				Vous pouvez <Link to="mailto:contact@bus-tracker.fr">m'envoyer un e-mail</Link> ou me contacter via{" "}
				<Link to="https://twitter.com/Keke27210" target="_blank">
					mon Twitter
				</Link>
				.
			</p>
		),
	},
] as const;

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
				<p>
					Build <code>{buildHash}</code> du {builtAt.format("LLLL")}.
				</p>
				<p>
					Un bug ? Une suggestion ? Une remarque ou une question ?<br />
					Envoyez-moi un e-mail à <Link to="mailto:contact@bus-tracker.fr">contact@bus-tracker.fr</Link> 😉
				</p>
				<Separator />
				<DialogTitle className="text-center sm:text-left">Questions fréquentes</DialogTitle>
				<Accordion type="single" collapsible>
					{qanda.map(({ question, answer }) => (
						<AccordionItem key={question} value={question}>
							<AccordionTrigger className="text-start">{question}</AccordionTrigger>
							<AccordionContent>{answer}</AccordionContent>
						</AccordionItem>
					))}
				</Accordion>
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
