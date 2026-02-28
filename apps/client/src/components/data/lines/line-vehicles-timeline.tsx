import { useSuspenseQuery } from "@tanstack/react-query";
import dayjs, { type Dayjs } from "dayjs";
import { Activity, useEffect, useEffectEvent, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataSet } from "vis-data";
import {
	type DataGroupCollectionType,
	type DataItemCollectionType,
	Timeline,
	type TimelineOptions,
} from "vis-timeline/standalone";

import { GetLineQuery, GetLineVehicleAssignmentsQuery } from "~/api/lines";

import "vis-timeline/styles/vis-timeline-graph2d.min.css";
import { GetNetworkQuery } from "~/api/networks";

type LineVehiclesTimelineProps = {
	lineId: number;
	date: string;
};

const numberSort = (aNumber: string, bNumber: string) => {
	const numberifiedA = parseInt(aNumber, 10);
	const numberifiedB = parseInt(bNumber, 10);

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

const toTimelineDate = (value: Dayjs, timezone: string) => {
	return new Date(dayjs(value).tz(timezone).format("YYYY-MM-DDTHH:mm:ss.SSS"));
};

export function LineVehiclesTimeline({ lineId, date }: Readonly<LineVehiclesTimelineProps>) {
	const containerRef = useRef<HTMLDivElement>(null);
	const lastConfiguredRef = useRef<{ timeline: Timeline; date: string } | null>(null);
	const [timeline, setTimeline] = useState<Timeline | null>(null);
	const [groups] = useState(() => new DataSet());
	const [items] = useState(() => new DataSet());
	const navigate = useNavigate();

	const { data: line } = useSuspenseQuery(GetLineQuery(lineId));
	const { data: network } = useSuspenseQuery(GetNetworkQuery(line.networkId, true));
	const { data: assignments } = useSuspenseQuery(GetLineVehicleAssignmentsQuery(lineId, date));

	const currentDate = dayjs.tz(date, network.timezone);

	useEffect(() => {
		if (containerRef.current === null) return;

		const options = {
			showCurrentTime: true,
			locale: "fr",
			orientation: "top",
			align: "center",
			maxHeight: "calc(100dvh - 310px)",
			zoomKey: "altKey",
			verticalScroll: true,
			horizontalScroll: true,
			xss: { disabled: false, filterOptions: { whiteList: { div: ["class"], span: ["class"] } } },
		} satisfies TimelineOptions;

		const currentTimeline = new Timeline(
			containerRef.current,
			items as unknown as DataItemCollectionType,
			groups as unknown as DataGroupCollectionType,
			options,
		);
		currentTimeline.on("click", (props) => {
			if (props.what === "group-label" && props.group) {
				navigate(`/data/vehicles/${props.group}`);
			}
		});

		setTimeline(currentTimeline);
		return () => {
			setTimeline(null);
			currentTimeline.destroy();
		};
	}, [navigate, items, groups]);

	useEffect(() => {
		if (!timeline) return;

		const update = () => {
			timeline.setCurrentTime(toTimelineDate(dayjs(), network.timezone));
		};

		update();
		const interval = setInterval(update, 10_000);

		return () => clearInterval(interval);
	}, [timeline, network.timezone]);

	const updateTimelineStartEnd = useEffectEvent(() => {
		if (!timeline) return;

		const formattedCurrentDate = currentDate.format("YYYY-MM-DD");
		if (lastConfiguredRef.current?.timeline === timeline && lastConfiguredRef.current?.date === formattedCurrentDate) {
			return;
		}

		lastConfiguredRef.current = { timeline, date: formattedCurrentDate };
		timeline.setOptions({
			start: toTimelineDate(currentDate.startOf("day").add(4, "hours"), network.timezone),
			end: toTimelineDate(currentDate.endOf("day").add(2, "hours"), network.timezone),
		});
	});

	useEffect(() => {
		if (timeline === null) {
			return;
		}

		const newGroups = assignments.vehicles
			.toSorted((a, b) => numberSort(a.number, b.number))
			.map((a) => ({
				id: a.id,
				content: `<div class="flex items-center gap-1">n°${a.number}${a.designation ? ` <span class="hidden text-muted-foreground text-sm lg:block">${a.designation}</span>` : ""}</div>`,
			}));

		const newItems = assignments.vehicles.flatMap((a) =>
			a.activities.map((act, index) => {
				const start = dayjs(act.startedAt).tz(network.timezone);
				const end = act.endedAt ? dayjs(act.endedAt).tz(network.timezone) : undefined;
				const timeRange = end
					? `<span class="font-bold">${start.format("HH:mm")}</span> - <span class="font-bold">${end.format("HH:mm")}</span>`
					: `depuis <span class="font-bold">${start.format("HH:mm")}</span>`;

				return {
					id: `${a.id}-${index}-${act.startedAt}`,
					group: a.id,
					start: toTimelineDate(start, network.timezone),
					end: toTimelineDate(end ?? dayjs(), network.timezone),
					type: "range",
					content: `<div class="leading-none overflow-hidden whitespace-nowrap">${timeRange}</div>`,
					title: `<div>${timeRange}</div>`,
				};
			}),
		);

		const [minStartedAt, maxUpdatedAt] = assignments.vehicles
			.flatMap((vehicle) => vehicle.activities)
			.reduce(
				([min, max], activity) => {
					const startedAt = dayjs(activity.startedAt).tz(network.timezone);
					const endedAt = activity.endedAt
						? dayjs(activity.endedAt).tz(network.timezone)
						: dayjs().tz(network.timezone);
					return [startedAt.isBefore(min) ? startedAt : min, endedAt?.isAfter(max) ? endedAt : max];
				},
				[dayjs.tz("2099-12-31", network.timezone), dayjs.tz("2000-01-01", network.timezone)],
			);

		groups.update(newGroups);
		items.update(newItems);

		const currentGroupIds = new Set(newGroups.map((g) => g.id));
		const groupsToRemove = groups.getIds().filter((id) => !currentGroupIds.has(id as number));
		if (groupsToRemove.length > 0) groups.remove(groupsToRemove);

		const currentItemIds = new Set(newItems.map((i) => i.id));
		const itemsToRemove = items.getIds().filter((id) => !currentItemIds.has(id as string));
		if (itemsToRemove.length > 0) items.remove(itemsToRemove);

		timeline.setOptions({
			min: toTimelineDate(minStartedAt.subtract(1, "hour"), network.timezone),
			max: toTimelineDate(maxUpdatedAt.add(1, "hour"), network.timezone),
		});

		updateTimelineStartEnd();
	}, [assignments, timeline, network.timezone, groups, items]);

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
				<p className="mt-4 text-center text-muted-foreground">
					Aucun véhicule n'a été observé sur cette ligne à cette date.
				</p>
			) : null}
		</>
	);
}
