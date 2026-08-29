import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { InformationChip } from "~/components/vehicles-map/vehicles-markers/popup/information-chip";
import * as m from "~/paraglide/messages";

/** Écart horizontal entre deux puces, en pixels — doit suivre le `gap-1` des rangées. */
const chipGap = 4;
/** Blanc minimal entre l'identité du véhicule et les puces qui la suivent. */
const minimumSpacing = 12;

const overflowChipClasses = "bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-100";

type InformationChipsRowProps = {
	chips: Array<{ key: string; element: ReactNode }>;
	/** Identité du véhicule, placée en tête de ligne. */
	leading: ReactNode;
};

/**
 * Range l'identité du véhicule et ses puces d'information sur une ligne unique. Faute de place,
 * les premières puces — les moins essentielles — se replient derrière un « … » qui les déploie,
 * plutôt que de faire passer la ligne à la ligne suivante.
 */
export function InformationChipsRow({ chips, leading }: Readonly<InformationChipsRowProps>) {
	const rowRef = useRef<HTMLDivElement>(null);
	const leadingRef = useRef<HTMLDivElement>(null);
	const measureRef = useRef<HTMLDivElement>(null);
	const [visibleCount, setVisibleCount] = useState(chips.length);

	// Mesuré à chaque rendu : les libellés changent au fil du temps (horodatage) et de la course.
	useLayoutEffect(() => {
		const row = rowRef.current;
		const leadingElement = leadingRef.current;
		const measure = measureRef.current;
		if (row === null || leadingElement === null || measure === null) return;

		const measured = Array.from(measure.children).map((child) => child.getBoundingClientRect().width);
		const overflowWidth = measured.at(-1) ?? 0;
		const chipWidths = measured.slice(0, -1);

		// Les puces se remplissent depuis la fin : les dernières sont celles qu'on tient à voir.
		const countFitting = (budget: number) => {
			let remaining = budget;
			let count = 0;
			for (let index = chipWidths.length - 1; index >= 0; index -= 1) {
				const needed = chipWidths[index] + (count > 0 ? chipGap : 0);
				if (needed > remaining) break;
				remaining -= needed;
				count += 1;
			}
			return count;
		};

		const available = row.clientWidth - leadingElement.getBoundingClientRect().width - minimumSpacing;
		let count = countFitting(available);
		// Dès qu'une puce se replie, le « … » réclame lui aussi sa place.
		if (count < chipWidths.length) count = countFitting(available - overflowWidth - chipGap);

		setVisibleCount((current) => (current === count ? current : count));
	});

	// Le suivi du redimensionnement complète la mesure au rendu : la carte peut changer de taille
	// sans que la pop-up ne se rende à nouveau.
	const [, forceMeasure] = useState(0);
	useLayoutEffect(() => {
		const row = rowRef.current;
		if (row === null || typeof ResizeObserver === "undefined") return;

		const observer = new ResizeObserver(() => forceMeasure((tick) => tick + 1));
		observer.observe(row);
		return () => observer.disconnect();
	}, []);

	const hiddenChips = chips.slice(0, Math.max(chips.length - visibleCount, 0));
	const visibleChips = chips.slice(hiddenChips.length);

	return (
		<div className="p-1">
			<div className="relative flex items-center gap-1" ref={rowRef}>
				<div className="flex min-w-0 items-center gap-1 overflow-hidden" ref={leadingRef}>
					{leading}
				</div>
				<div className="ml-auto flex shrink-0 items-center gap-1">
					{hiddenChips.length > 0 && (
						<Popover>
							<PopoverTrigger
								render={
									<InformationChip className={overflowChipClasses} label="…" title={m.marker_chip_more_information()} />
								}
							/>
							<PopoverContent align="end" className="w-fit min-w-0 flex-row flex-wrap gap-1 p-2" side="bottom">
								{hiddenChips.map((chip) => (
									<span className="flex items-center" key={chip.key}>
										{chip.element}
									</span>
								))}
							</PopoverContent>
						</Popover>
					)}
					{visibleChips.map((chip) => (
						<span className="flex items-center" key={chip.key}>
							{chip.element}
						</span>
					))}
				</div>
				<div
					aria-hidden="true"
					className="pointer-events-none invisible absolute top-0 left-0 flex w-max items-center gap-1"
					ref={measureRef}
				>
					{chips.map((chip) => (
						<span className="flex items-center" key={chip.key}>
							{chip.element}
						</span>
					))}
					<span className="flex items-center">
						<InformationChip className={overflowChipClasses} label="…" />
					</span>
				</div>
			</div>
		</div>
	);
}
