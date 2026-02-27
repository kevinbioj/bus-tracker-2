import { useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Timeline, type TimelineOptions } from "vis-timeline/standalone";

import { GetLineQuery, GetLineVehicleAssignmentsQuery } from "~/api/lines";

import "vis-timeline/styles/vis-timeline-graph2d.min.css";

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

export function LineVehiclesTimeline({ lineId, date }: Readonly<LineVehiclesTimelineProps>) {
	const containerRef = useRef<HTMLDivElement>(null);
	const timelineRef = useRef<Timeline | null>(null);
	const navigate = useNavigate();

	const { data: line } = useSuspenseQuery(GetLineQuery(lineId));
	const { data: assignments } = useSuspenseQuery(GetLineVehicleAssignmentsQuery(lineId, date));

	const currentDate = dayjs(date);

	useEffect(() => {
		if (containerRef.current === null) return;

		const options = {
			start: currentDate.startOf("day").add(4, "hours").toDate(),
			end: currentDate.endOf("day").add(2, "hours").toDate(),
			showCurrentTime: true,
			locale: "fr",
			orientation: "top",
			align: "center",
			maxHeight: "calc(100dvh - 330px)",
			zoomKey: "altKey",
			verticalScroll: true,
			horizontalScroll: true,
			xss: { disabled: false, filterOptions: { whiteList: { div: ["class"], span: ["class"] } } },
		} satisfies TimelineOptions;

		timelineRef.current = new Timeline(containerRef.current, [], [], options);
		timelineRef.current.on("click", (props) => {
			if (props.what === "group-label" && props.group) {
				navigate(`/data/vehicles/${props.group}`);
			}
		});

		return () => {
			if (timelineRef.current === null) return;
			timelineRef.current.destroy();
			timelineRef.current = null;
		};
	}, [currentDate, navigate]);

	useEffect(() => {
		if (timelineRef.current === null) return;

		const groups = assignments.vehicles
			.toSorted((a, b) => numberSort(a.number, b.number))
			.map((a) => ({
				id: a.id,
				content: `<div class="flex items-center gap-1">n°${a.number}${a.designation ? ` <span class="hidden text-muted-foreground text-sm lg:block">${a.designation}</span>` : ""}</div>`,
			}));

		const items = assignments.vehicles.flatMap((a) =>
			a.activities.map((act, index) => {
				const start = dayjs(act.startedAt);
				const end = act.endedAt ? dayjs(act.endedAt) : undefined;
				const timeRange = end
					? `<span class="font-bold">${start.format("HH:mm")}</span> - <span class="font-bold">${end.format("HH:mm")}</span>`
					: `depuis <span class="font-bold">${start.format("HH:mm")}</span>`;

				return {
					id: `${a.id}-${index}-${act.startedAt}`,
					group: a.id,
					start: start.toDate(),
					end: (end ?? dayjs()).toDate(),
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
					const startedAt = dayjs(activity.startedAt);
					const endedAt = activity.endedAt ? dayjs(activity.endedAt) : dayjs();
					return [startedAt.isBefore(min) ? startedAt : min, endedAt?.isAfter(max) ? endedAt : max];
				},
				[dayjs("2099-31-12"), dayjs("2000-01-01")],
			);

		timelineRef.current.setGroups(groups);
		timelineRef.current.setItems(items);
		timelineRef.current.setOptions({
			min: minStartedAt.subtract(1, "hour").toDate(),
			max: maxUpdatedAt.add(1, "hour").toDate(),
		});
	}, [assignments, currentDate]);

	return assignments.vehicles.length > 0 ? (
		<div className="border rounded-lg bg-white dark:bg-neutral-900 vis-timeline-custom min-h-32">
			<style>
				{`
					.vis-timeline-custom .vis-timeline {
						border: none;
						font-family: inherit;
					}

					.vis-timeline-custom .vis-item {
						background-color: #${line.color};
						border-color: #${line.color};
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
			<div ref={containerRef} />
		</div>
	) : (
		<p className="mt-4 text-center text-muted-foreground">
			Aucun véhicule n'a été observé sur cette ligne à cette date.
		</p>
	);
}
