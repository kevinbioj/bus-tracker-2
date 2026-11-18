import { and, between, eq } from "drizzle-orm";

import { database } from "../database/database.js";
import { lineActivitiesTable } from "../database/schema.js";

export type VehicleActivityTimeline = {
	date: Temporal.PlainDate;
	activities: { type: "LINE_ACTIVITY"; lineId: number; startedAt: string; updatedAt: string }[];
}[];

export async function findVehicleActivityTimeline(
	vehicleId: number,
	month: Temporal.PlainYearMonth,
	timezone: string,
): Promise<VehicleActivityTimeline> {
	const lineActivityList = await database
		.select()
		.from(lineActivitiesTable)
		.where(
			and(
				eq(lineActivitiesTable.vehicleId, vehicleId),
				between(
					lineActivitiesTable.serviceDate,
					month.toPlainDate({ day: 1 }).toString(),
					month.toPlainDate({ day: month.daysInMonth }).toString(),
				),
			),
		);

	const lineActivitiesByDay = Map.groupBy(lineActivityList, (lineActivity) => lineActivity.serviceDate);

	const toLocal = (instant: Temporal.Instant) =>
		instant.toZonedDateTimeISO(timezone).toString({ timeZoneName: "never" });

	return [...lineActivitiesByDay.keys()]
		.map((date) => Temporal.PlainDate.from(date))
		.toSorted((a, b) => Temporal.PlainDate.compare(b, a))
		.map((date) => ({
			date,
			activities: (lineActivitiesByDay.get(date.toString()) ?? [])
				.map((lineActivity) => ({
					type: "LINE_ACTIVITY" as const,
					lineId: lineActivity.lineId,
					startedAt: toLocal(lineActivity.startedAt),
					updatedAt: toLocal(lineActivity.updatedAt),
				}))
				.toSorted((a, b) => b.startedAt.localeCompare(a.startedAt)),
		}));
}
