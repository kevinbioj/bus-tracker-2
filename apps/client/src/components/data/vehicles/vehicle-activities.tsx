import { useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { GetVehicleActivitiesQuery, GetVehicleQuery } from "~/api/vehicles";
import { ActivityCard } from "~/components/data/vehicles/activity-card";
import { Link } from "~/components/ui/link";

const parseMonth = (input: string | null, validMonths: string[]) => {
	if (input === null || !validMonths.includes(input)) return validMonths.at(-1) ?? dayjs().format("YYYY-MM");
	return input;
};

type VehicleActivitiesProps = {
	vehicleId: number;
};

export function VehicleActivities({ vehicleId }: VehicleActivitiesProps) {
	const [searchParams] = useSearchParams();

	const { data: vehicle } = useSuspenseQuery(GetVehicleQuery(vehicleId));

	const month = parseMonth(searchParams.get("month"), vehicle.activeMonths);
	const currentMonthIndex = vehicle.activeMonths.indexOf(month);

	const { data: activities } = useSuspenseQuery(GetVehicleActivitiesQuery(vehicle.id, month));
	return (activities?.timeline.length ?? 0) > 0 ? (
		<div className="flex-1">
			<h2 className="hidden">Activités du véhicule</h2>
			<section>
				<div className="bg-branding text-branding-foreground grid grid-cols-[3rem_1fr_3rem] px-3 py-2 rounded-md">
					{currentMonthIndex > 0 ? (
						<Link
							className="transition-opacity hover:opacity-70"
							to={`?month=${vehicle.activeMonths.at(currentMonthIndex - 1)}`}
						>
							<ChevronLeft
								aria-label="Période précédente"
								className="mx-auto"
								color="white"
								width={32}
								height={32}
								strokeWidth={2.5}
							/>
						</Link>
					) : (
						<div />
					)}
					<p className="font-bold my-auto text-2xl text-center">
						<span className="hidden lg:inline">activité de </span>
						{dayjs(month).format("MMMM YYYY")}
					</p>
					{currentMonthIndex < vehicle.activeMonths.length - 1 ? (
						<Link
							className="transition-opacity hover:opacity-70"
							to={`?month=${vehicle.activeMonths.at(currentMonthIndex + 1)}`}
						>
							<ChevronRight
								aria-label="Période suivante"
								className="mx-auto"
								color="white"
								width={32}
								height={32}
								strokeWidth={2.5}
							/>
						</Link>
					) : (
						<div />
					)}
				</div>
			</section>
			<section className="flex flex-col gap-3 mt-2 w-full lg:max-h-[calc(100dvh-15.3rem)] lg:overflow-y-scroll">
				{activities?.timeline
					.sort(
						({ date: dateA }, { date: dateB }) => dayjs(dateB, "DD/MM/YYYY").unix() - dayjs(dateA, "DD/MM/YYYY").unix(),
					)
					.map(({ date, activities }) => (
						<div className="flex flex-col gap-2 items-center sm:flex-row sm:items-start" key={date}>
							<h3 className="text-center text-xl sm:text-right sm:w-72">
								{dayjs(date, "DD/MM/YYYY").format("dddd DD MMMM")}
							</h3>
							<div className="flex flex-col gap-2 w-full">
								{activities.map((activity) => (
									<ActivityCard
										activity={activity}
										key={`${activity.lineId}_${activity.startedAt}_${activity.updatedAt}`}
									/>
								))}
							</div>
						</div>
					))}
			</section>
		</div>
	) : (
		<p className="mt-3 text-center text-muted-foreground text-xl">
			Ce véhicule n&apos;a pas encore été observé en service commercial.
		</p>
	);
}
