import type { ServiceAlertEffect } from "@bus-tracker/contracts";
import dayjs from "dayjs";
import { ExternalLinkIcon } from "lucide-react";
import { useRef } from "react";

import type { ServiceAlert } from "~/api/service-alerts";
import { ServiceAlertDescription } from "~/components/service-alerts/service-alert-description";
import { pickImage, pickTranslation } from "~/components/service-alerts/translated-text";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import * as m from "~/paraglide/messages";
import { cn } from "~/utils/cn";

const severeClasses = "bg-red-700 dark:bg-red-600 text-white";
const disruptionClasses = "bg-orange-700 dark:bg-orange-600 text-white";
const changeClasses = "bg-amber-600 dark:bg-amber-500 text-white dark:text-black";
const informationClasses = "bg-sky-700 dark:bg-sky-600 text-white";
const neutralClasses = "bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-100";

const effectDetails: Record<ServiceAlertEffect, { label: () => string; classes: string }> = {
	NO_SERVICE: { label: m.service_alert_effect_no_service, classes: severeClasses },
	REDUCED_SERVICE: { label: m.service_alert_effect_reduced_service, classes: disruptionClasses },
	SIGNIFICANT_DELAYS: { label: m.service_alert_effect_significant_delays, classes: disruptionClasses },
	DETOUR: { label: m.service_alert_effect_detour, classes: disruptionClasses },
	STOP_MOVED: { label: m.service_alert_effect_stop_moved, classes: changeClasses },
	MODIFIED_SERVICE: { label: m.service_alert_effect_modified_service, classes: changeClasses },
	ADDITIONAL_SERVICE: { label: m.service_alert_effect_additional_service, classes: informationClasses },
	ACCESSIBILITY_ISSUE: { label: m.service_alert_effect_accessibility_issue, classes: informationClasses },
	NO_EFFECT: { label: m.service_alert_effect_no_effect, classes: neutralClasses },
	OTHER_EFFECT: { label: m.service_alert_effect_other, classes: neutralClasses },
	UNKNOWN_EFFECT: { label: m.service_alert_effect_other, classes: neutralClasses },
};

/**
 * Ce qui intéresse le voyageur, c'est quand la perturbation a lieu : la période d'impact, à défaut
 * celle de communication, à défaut celle d'activité. De celles-ci, la période en cours, sinon la
 * prochaine — une alerte encore diffusée peut porter des périodes d'impact échues —, sinon la première.
 */
function formatPeriod(alert: ServiceAlert) {
	const periods = [alert.impactPeriods, alert.communicationPeriods, alert.activePeriods].find(
		(candidate) => candidate !== undefined && candidate.length > 0,
	);
	if (periods === undefined) return;

	const now = Date.now();
	const upcoming = periods
		.filter(({ start }) => start !== undefined && now < Date.parse(start))
		.sort((a, b) => Date.parse(a.start!) - Date.parse(b.start!));
	const period =
		periods.find(
			({ start, end }) =>
				(start === undefined || Date.parse(start) <= now) && (end === undefined || now < Date.parse(end)),
		) ??
		upcoming[0] ??
		periods[0];
	if (period === undefined) return;

	const format = (date: string) => {
		const value = dayjs(date);
		const onDayBoundary = value.isSame(value.startOf("day"), "minute") || value.isSame(value.endOf("day"), "minute");
		return value.format(onDayBoundary ? "L" : "L LT");
	};
	if (period.start !== undefined && period.end !== undefined) {
		return m.service_alerts_between({ start: format(period.start), end: format(period.end) });
	}
	if (period.start !== undefined) return m.service_alerts_since({ date: format(period.start) });
	if (period.end !== undefined) return m.service_alerts_until({ date: format(period.end) });
}

/** Délai pendant lequel une alerte tout juste dépliée est ramenée à l'écran, image chargée comprise. */
const REVEAL_WINDOW_MS = 3_000;

function ServiceAlertItem({ alert }: Readonly<{ alert: ServiceAlert }>) {
	const itemRef = useRef<HTMLDivElement>(null);
	const revealUntilRef = useRef(0);

	// Une alerte dépliée en bas de liste déborderait : on la fait défiler jusqu'à la montrer entière, ou
	// au moins depuis son titre si elle est plus haute que la fenêtre. L'image, chargée après coup,
	// l'allonge encore : son chargement relance le défilement tant que l'ouverture est récente.
	const reveal = () => {
		if (Date.now() > revealUntilRef.current) return;
		const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		itemRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
	};

	const effect = effectDetails[alert.effect ?? "UNKNOWN_EFFECT"];
	const header = pickTranslation(alert.header);
	const description = pickTranslation(alert.description);
	const url = pickTranslation(alert.url);
	const image = pickImage(alert.image);
	const imageAlternativeText = pickTranslation(alert.imageAlternativeText);
	const period = formatPeriod(alert);

	const hasDescription = description !== undefined && description !== header;
	const hasImage = image !== undefined && /^https?:\/\//.test(image);
	const hasUrl = url !== undefined && /^https?:\/\//.test(url);

	// Seul le titre est montré d'emblée : le détail, souvent long, ne se déplie qu'à la demande.
	return (
		<AccordionItem
			// Laisse dépasser le haut de l'alerte suivante, pour qu'on puisse la déplier sans défiler.
			className="scroll-mb-12"
			onOpenChange={(open) => {
				revealUntilRef.current = open ? Date.now() + REVEAL_WINDOW_MS : 0;
			}}
			ref={itemRef}
			value={alert.id}
		>
			<AccordionTrigger className="gap-2 hover:no-underline">
				<span className="min-w-0 flex-1 space-y-1">
					<span className="flex flex-wrap items-center gap-x-2 gap-y-1">
						<span className={cn("rounded-sm px-1 py-0.5 text-[11px] font-semibold leading-none", effect.classes)}>
							{effect.label()}
						</span>
						{period !== undefined && <span className="text-xs font-normal text-muted-foreground">{period}</span>}
					</span>
					<span className="block font-bold leading-snug text-foreground">{header ?? effect.label()}</span>
				</span>
			</AccordionTrigger>
			<AccordionContent className="space-y-2" onAnimationEnd={reveal}>
				{hasDescription && <ServiceAlertDescription className="text-sm text-foreground" html={description} />}
				{hasImage && (
					<img
						alt={imageAlternativeText ?? ""}
						className="h-auto max-w-full rounded-sm"
						decoding="async"
						onLoad={reveal}
						referrerPolicy="no-referrer"
						src={image}
					/>
				)}
				{hasUrl && (
					<a
						className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline underline-offset-2"
						href={url}
						rel="noopener noreferrer"
						target="_blank"
					>
						{m.service_alerts_more_info()}
						<ExternalLinkIcon className="size-3.5" />
					</a>
				)}
			</AccordionContent>
		</AccordionItem>
	);
}

export type ServiceAlertsScope = "journey" | "line" | "stop";

const scopeTitles: Record<ServiceAlertsScope, () => string> = {
	journey: m.service_alerts_title_journey,
	line: m.service_alerts_title_line,
	stop: m.service_alerts_title_stop,
};

type ServiceAlertsDialogProps = {
	alerts: ServiceAlert[];
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Ce que visent les alertes, qui donne son titre à la fenêtre. */
	scope: ServiceAlertsScope;
};

/**
 * Info trafic d'un arrêt, d'une course ou d'une ligne. Le corps défile sur un écran court, titre et
 * pied restant en place — comme les fenêtres d'aide de la pop-up véhicule.
 */
export function ServiceAlertsDialog({ alerts, open, onOpenChange, scope }: Readonly<ServiceAlertsDialogProps>) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				aria-describedby="service-alerts-dialog-description"
				// Ouverte depuis le drawer des prochains passages, elle y serait imbriquée, et sans fond.
				forceOverlay
				className="max-h-[85dvh] grid-rows-[auto_minmax(0,1fr)_auto]"
			>
				<DialogHeader>
					<DialogTitle>{scopeTitles[scope]()}</DialogTitle>
				</DialogHeader>
				<DialogDescription
					className="min-h-0 overflow-y-auto overscroll-contain px-0.5 pb-1"
					id="service-alerts-dialog-description"
					render={<div />}
				>
					{/* Une alerte seule est dépliée d'office : il n'y a rien à choisir. */}
					<Accordion defaultValue={alerts.length === 1 ? [alerts[0]!.id] : []}>
						{alerts.map((alert) => (
							<ServiceAlertItem alert={alert} key={alert.id} />
						))}
					</Accordion>
				</DialogDescription>
				<DialogFooter>
					<DialogClose render={<Button type="button">{m.service_alerts_close()}</Button>} />
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
