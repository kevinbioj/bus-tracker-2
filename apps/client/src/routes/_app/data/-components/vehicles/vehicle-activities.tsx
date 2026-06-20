import { keepPreviousData, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";

import { GetVehicleActivitiesQuery, GetVehicleQuery } from "~/api/vehicles";
import * as m from "~/paraglide/messages";
import { PeriodNavigator } from "~/routes/_app/data/-components/period-navigator";
import { ActivityCard } from "~/routes/_app/data/-components/vehicles/activity-card";

const parseMonth = (input: string | null, validMonths: string[]) => {
	if (input === null || !validMonths.includes(input))
		return validMonths[validMonths.length - 1] ?? dayjs().format("YYYY-MM");
	return input;
};

type VehicleActivitiesProps = {
	vehicleId: number;
};

export function VehicleActivities({ vehicleId }: VehicleActivitiesProps) {
	const [selectedMonth] = useQueryState("month", parseAsString);

	const { data: vehicle } = useSuspenseQuery(GetVehicleQuery(vehicleId));

	const month = parseMonth(selectedMonth, vehicle.activeMonths);
	const currentMonthIndex = vehicle.activeMonths.indexOf(month);

	const { data: activities } = useQuery({
		...GetVehicleActivitiesQuery(vehicle.id, month),
		placeholderData: keepPreviousData,
	});

	if (activities?.timeline === undefined) {
		return null;
	}

	return (activities?.timeline.length ?? 0) > 0 ? (
		<div className="flex-1">
			<h2 className="hidden">{m.vehicle_activities_title()}</h2>
			<PeriodNavigator
				sticky
				previous={
					currentMonthIndex > 0 ? (
						<Link
							className="transition-opacity hover:opacity-70 active:not-aria-[haspopup]:translate-y-px"
							from="/data/vehicles/$vehicleId"
							to="."
							search={(prev) => ({ ...prev, month: vehicle.activeMonths[currentMonthIndex - 1] })}
						>
							<ChevronLeft
								aria-label={m.period_previous()}
								className="mx-auto"
								color="white"
								width={32}
								height={32}
								strokeWidth={2.5}
							/>
						</Link>
					) : (
						<div />
					)
				}
				next={
					currentMonthIndex < vehicle.activeMonths.length - 1 ? (
						<Link
							className="transition-opacity hover:opacity-70 active:not-aria-[haspopup]:translate-y-px"
							from="/data/vehicles/$vehicleId"
							to="."
							search={(prev) => ({ ...prev, month: vehicle.activeMonths[currentMonthIndex + 1] })}
						>
							<ChevronRight
								aria-label={m.period_next()}
								className="mx-auto"
								color="white"
								width={32}
								height={32}
								strokeWidth={2.5}
							/>
						</Link>
					) : (
						<div />
					)
				}
			>
				<span className="hidden lg:inline">{m.activity_of()}</span>
				{dayjs(month).format("MMMM YYYY")}
			</PeriodNavigator>
			<section className="flex flex-col gap-3 w-full">
				{activities?.timeline
					.sort(
						({ date: dateA }, { date: dateB }) => dayjs(dateB, "DD/MM/YYYY").unix() - dayjs(dateA, "DD/MM/YYYY").unix(),
					)
					.map(({ date, activities }) => (
						<div className="flex flex-col gap-2 items-center sm:flex-row sm:items-start" key={date}>
							<h3 className="sm:sticky sm:top-29 bg-background py-1 text-center text-xl sm:text-right sm:w-72">
								{dayjs(date, "DD/MM/YYYY").format("dddd DD MMMM")}
							</h3>
							<div className="flex flex-col gap-2 w-full">
								{activities.map((activity) => (
									<ActivityCard
										activity={activity}
										day={date}
										key={`${activity.lineId}_${activity.startedAt}_${activity.updatedAt}`}
									/>
								))}
							</div>
						</div>
					))}
			</section>
		</div>
	) : (
		<p className="mt-3 text-center text-muted-foreground text-xl">{m.vehicle_no_activity()}</p>
	);
}
