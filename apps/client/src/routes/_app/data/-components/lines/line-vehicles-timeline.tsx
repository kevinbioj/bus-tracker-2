import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import dayjs, { type Dayjs } from "dayjs";
import { Activity, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { DataSet } from "vis-data";
import {
	type DataGroupCollectionType,
	type DataItemCollectionType,
	Timeline,
	type TimelineOptions,
} from "vis-timeline/standalone";

import { GetLineQuery, GetLineVehicleAssignmentsQuery } from "~/api/lines";

import { GetNetworkQuery } from "~/api/networks";
import * as m from "~/paraglide/messages";
import { getLocale } from "~/paraglide/runtime";
import { dayjsTz, resolveTimezone } from "~/utils/timezone";

type LineVehiclesTimelineProps = {
	lineId: number;
	date: string;
};

const numberSort = (aNumber: string, bNumber: string) => {
	const numberifiedA = Number.parseInt(aNumber, 10);
	const numberifiedB = Number.parseInt(bNumber, 10);

	if (Number.isNaN(numberifiedA)) {
		if (Number.isNaN(numberifiedB)) {
			return aNumber.localeCompare(bNumber);
		}
		return 1;
	}

	if (Number.isNaN(numberifiedB)) {
		return -1;
	}
	return numberifiedA - numberifiedB;
};

const toTimelineDate = (value: Dayjs, timezone?: string) => {
	return new Date(dayjsTz(value, timezone).format("YYYY-MM-DDTHH:mm:ss.SSS"));
};

export function LineVehiclesTimeline({ lineId, date }: Readonly<LineVehiclesTimelineProps>) {
	const containerRef = useRef<HTMLDivElement>(null);
	const timelineRef = useRef<Timeline | null>(null);
	const [groups] = useState(() => new DataSet());
	const [items] = useState(() => new DataSet());
	const navigate = useNavigate();

	const { data: line } = useSuspenseQuery(GetLineQuery(lineId));
	const { data: network } = useSuspenseQuery(GetNetworkQuery(line.networkId, true));
	const { data: assignments } = useSuspenseQuery(GetLineVehicleAssignmentsQuery(lineId, date));

	const timezone = resolveTimezone(network.timezone);
	const currentDate = dayjs.tz(date, timezone);

	const { newGroups, newItems, minStartedAt, maxUpdatedAt } = useMemo(() => {
		const now = dayjs().tz(timezone);
		const groups = assignments.vehicles
			.toSorted((a, b) => numberSort(a.number, b.number))
			.map((a) => ({
				id: a.id,
				number: a.number,
				content: `<div class="flex items-center gap-1">n°${a.number}${a.designation ? ` <span class="hidden text-muted-foreground text-sm lg:block">${a.designation}</span>` : ""}</div>`,
			}));

		const items = assignments.vehicles.flatMap((a) =>
			a.activities.map((act, index) => {
				const start = dayjs(act.startedAt).tz(timezone);
				const end = act.endedAt ? dayjs(act.endedAt).tz(timezone) : undefined;
				const timeRange = end
					? `<span class="font-bold">${start.format("HH:mm")}</span> - <span class="font-bold">${end.format("HH:mm")}</span>`
					: `${m.line_assignments_since()} <span class="font-bold">${start.format("HH:mm")}</span>`;

				return {
					id: `${a.id}-${index}-${act.startedAt}`,
					group: a.id,
					start: toTimelineDate(start, timezone),
					end: toTimelineDate(end ?? now, timezone),
					type: "range",
					content: `<div class="leading-none overflow-hidden whitespace-nowrap">${timeRange}</div>`,
					title: `<div>${timeRange}</div>`,
				};
			}),
		);

		let min = dayjs.tz("2099-12-31", timezone);
		let max = dayjs.tz("2000-01-01", timezone);

		for (const vehicle of assignments.vehicles) {
			for (const activity of vehicle.activities) {
				const startedAt = dayjs(activity.startedAt).tz(timezone);
				const endedAt = activity.endedAt ? dayjs(activity.endedAt).tz(timezone) : now;
				if (startedAt.isBefore(min)) min = startedAt;
				if (endedAt.isAfter(max)) max = endedAt;
			}
		}

		// Aucune activité : les bornes restent inversées, on retombe sur la journée sélectionnée.
		if (max.isBefore(min)) {
			const selectedDay = dayjs.tz(date, timezone);
			min = selectedDay.startOf("day");
			max = selectedDay.endOf("day");
		}

		return { newGroups: groups, newItems: items, minStartedAt: min, maxUpdatedAt: max };
	}, [assignments, timezone, date]);

	// Applique les données courantes aux DataSets. Extrait en effect event pour pouvoir être
	// appelé au moment de la construction de la timeline, sans dépendre d'un rendu supplémentaire.
	const syncDataSets = useEffectEvent(() => {
		groups.update(newGroups);
		items.update(newItems);

		const currentGroupIds = new Set(newGroups.map((g) => g.id));
		const groupsToRemove = groups.getIds().filter((id) => !currentGroupIds.has(id as number));
		if (groupsToRemove.length > 0) groups.remove(groupsToRemove);

		const currentItemIds = new Set(newItems.map((i) => i.id));
		const itemsToRemove = items.getIds().filter((id) => !currentItemIds.has(id as string));
		if (itemsToRemove.length > 0) items.remove(itemsToRemove);
	});

	const getBounds = useEffectEvent(() => ({
		min: toTimelineDate(minStartedAt.subtract(1, "hour"), timezone),
		max: toTimelineDate(maxUpdatedAt.add(1, "hour"), timezone),
	}));

	const getWindow = useEffectEvent(() => ({
		start: toTimelineDate(currentDate.startOf("day").add(4, "hours"), timezone),
		end: toTimelineDate(currentDate.endOf("day").add(2, "hours"), timezone),
	}));

	const handleClick = useEffectEvent((props: { what?: string | null; group?: string | number | null }) => {
		if (props.what === "group-label" && props.group) {
			void navigate({ to: "/data/vehicles/$vehicleId", params: { vehicleId: String(props.group) } });
		}
	});

	useEffect(() => {
		const container = containerRef.current;
		if (container === null) return;

		const options = {
			showCurrentTime: true,
			locale: getLocale(),
			orientation: "top",
			align: "center",
			maxHeight: `calc(100svh - ${window.innerWidth >= 640 ? 316 : 260}px)`,
			zoomKey: "altKey",
			verticalScroll: true,
			horizontalScroll: true,
			xss: { disabled: false, filterOptions: { whiteList: { div: ["class"], span: ["class"] } } },
			groupOrder: (a: { number: string }, b: { number: string }) => numberSort(a.number, b.number),
			...getBounds(),
			...getWindow(),
		} satisfies TimelineOptions;

		// Les DataSets sont remplis AVANT la construction : la timeline naît avec ses données
		// et sa fenêtre. Sans ça, elle serait créée vide et n'aurait été alimentée qu'au rendu
		// suivant — rendu qui n'a pas toujours lieu (suspension d'une query, <Activity>, remount).
		syncDataSets();

		const currentTimeline = new Timeline(
			container,
			items as unknown as DataItemCollectionType,
			groups as unknown as DataGroupCollectionType,
			options,
		);
		currentTimeline.on("click", handleClick);
		timelineRef.current = currentTimeline;

		// Le conteneur peut encore mesurer 0px à la construction (révélé juste après par
		// <Activity> ou par la levée d'un Suspense) : vis-timeline dessinerait alors dans le vide.
		const resizeObserver = new ResizeObserver(() => currentTimeline.redraw());
		resizeObserver.observe(container);

		return () => {
			resizeObserver.disconnect();
			timelineRef.current = null;
			currentTimeline.destroy();
		};
	}, [items, groups]);

	useEffect(() => {
		const update = () => {
			timelineRef.current?.setCurrentTime(toTimelineDate(dayjs(), timezone));
		};

		update();
		const interval = setInterval(update, 10_000);

		return () => clearInterval(interval);
	}, [timezone]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: doit se relancer à chaque changement de données, lues via des effect events
	useEffect(() => {
		const timeline = timelineRef.current;
		if (timeline === null) return;

		syncDataSets();
		timeline.setOptions(getBounds());
	}, [newGroups, newItems, minStartedAt, maxUpdatedAt, timezone]);

	// Recadre la fenêtre visible uniquement sur changement de jour, pour ne pas écraser
	// le zoom/défilement de l'utilisateur à chaque rafraîchissement des données.
	// biome-ignore lint/correctness/useExhaustiveDependencies: la fenêtre est lue via un effect event
	useEffect(() => {
		const timeline = timelineRef.current;
		if (timeline === null) return;

		const { start, end } = getWindow();
		timeline.setWindow(start, end, { animation: false });
	}, [date, timezone]);

	return (
		<>
			<style>
				{`
			.vis-timeline-custom .vis-timeline {
				border: none;
				font-family: inherit;
			}

			.vis-timeline-custom .vis-item {
				background-color: #${line.color};
				border-color: #${line.textColor};
				color: #${line.textColor};
			}

			.vis-timeline-custom .vis-label {
				color: var(--foreground);
				cursor: pointer;
			}
			
			.vis-time-axis .vis-grid.vis-minor {
				border-color: var(--border);
			}

			.vis-timeline-custom .vis-time-axis .vis-text {
				color: var(--muted-foreground);
			}

			.vis-timeline-custom .vis-panel.vis-background.vis-vertical {
				border-left: 1px solid var(--border);
			}

			.vis-timeline-custom .vis-panel.vis-bottom, 
			.vis-timeline-custom .vis-panel.vis-center, 
			.vis-timeline-custom .vis-panel.vis-left, 
			.vis-timeline-custom .vis-panel.vis-right, 
			.vis-timeline-custom .vis-panel.vis-top {
				border-color: var(--border);
			}

			.vis-item.vis-range {
				border-radius: var(--radius);
			}
			
			.vis-label.vis-group-level-0 {
				display: flex;
				align-items: center;
			}
				`}
			</style>
			<Activity mode={assignments.vehicles.length > 0 ? "visible" : "hidden"}>
				<div className="border rounded-lg bg-white dark:bg-neutral-900 vis-timeline-custom" ref={containerRef} />
			</Activity>
			{assignments.vehicles.length === 0 ? (
				<p className="mt-4 text-center text-muted-foreground">{m.line_assignments_empty()}</p>
			) : null}
		</>
	);
}
