import { LucideCircleHelp, SatelliteDishIcon } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";

import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Link } from "~/components/ui/link";

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
		question: "Pourquoi mon réseau n'apparait-il pas ?",
		answer: <p>Si vous pensez que votre réseau de transport mérite sa place, faites-le moi savoir par e-mail 😉</p>,
	},
] as const;

export function Help() {
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button size="icon" variant="branding-outline">
					<LucideCircleHelp aria-label="Questions fréquentes" />
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Questions fréquentes</DialogTitle>
				</DialogHeader>
				<Accordion type="single" collapsible>
					{qanda.map(({ question, answer }) => (
						<AccordionItem key={question} value={question}>
							<AccordionTrigger>{question}</AccordionTrigger>
							<AccordionContent>{answer}</AccordionContent>
						</AccordionItem>
					))}
				</Accordion>
				<p>
					Encore une question dans la tête ?<br />
					Envoyez-moi un e-mail à <Link to="mailto:contact@bus-tracker.fr">contact@bus-tracker.fr</Link> 😉
				</p>
			</DialogContent>
		</Dialog>
	);
}
