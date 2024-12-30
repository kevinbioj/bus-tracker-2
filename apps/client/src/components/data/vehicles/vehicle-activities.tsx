import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { GetVehicleActivitiesQuery, GetVehicleQuery } from "~/api/vehicles";
import { ActivityCard } from "~/components/data/vehicles/activity-card";
import { Link } from "~/components/ui/link";

const parseMonth = (input: string | null) => {
	const month = dayjs(input, "YYYY-MM");
	return (month.isValid() ? month : dayjs()).format("YYYY-MM");
};

type VehicleActivitiesProps = {
	vehicleId: number;
};

export function VehicleActivities({ vehicleId }: VehicleActivitiesProps) {
	const [searchParams] = useSearchParams();

	const month = parseMonth(searchParams.get("month"));

	const { data: vehicle } = useSuspenseQuery(GetVehicleQuery(vehicleId));
	const { data: activities } = useQuery(GetVehicleActivitiesQuery(vehicle.id, month));

	const currentMonthIndex = vehicle.activeMonths.indexOf(month);

	return (activities?.timeline.length ?? 0) > 0 ? (
		<>
			<section>
				<div className="bg-brand grid grid-cols-[3rem_1fr_3rem] px-3 py-2 rounded-md">
					{currentMonthIndex > 0 ? (
						<Link
							className="hover:brightness-75 hover:transition"
							to={`?month=${vehicle.activeMonths.at(currentMonthIndex - 1)}`}
						>
							<ChevronLeft className="mx-auto" color="white" width={32} height={32} strokeWidth={2.5} />
						</Link>
					) : (
						<div />
					)}
					<p className="font-bold my-auto select-none text-2xl text-center text-white">
						{dayjs(month).format("MMMM YYYY")}
					</p>
					{currentMonthIndex < vehicle.activeMonths.length - 1 ? (
						<Link
							className="hover:brightness-75 hover:transition"
							to={`?month=${vehicle.activeMonths.at(currentMonthIndex + 1)}`}
						>
							<ChevronRight className="mx-auto" color="white" width={32} height={32} strokeWidth={2.5} />
						</Link>
					) : (
						<div />
					)}
				</div>
			</section>
			<section className="flex flex-col gap-3 mt-5 w-full">
				{activities?.timeline
					.sort(
						({ date: dateA }, { date: dateB }) => dayjs(dateB, "DD/MM/YYYY").unix() - dayjs(dateA, "DD/MM/YYYY").unix(),
					)
					.map(({ date, activities }) => (
						<div className="flex flex-col gap-2 items-center sm:flex-row sm:items-start" key={date}>
							<h4 className="text-center text-xl sm:text-right sm:w-72">
								{dayjs(date, "DD/MM/YYYY").format("dddd DD MMMM")}
							</h4>
							<div className="flex flex-col gap-2 w-full">
								{activities.map((activity) => (
									<ActivityCard activity={activity} key={activity.startedAt} />
								))}
							</div>
						</div>
					))}
			</section>
		</>
	) : (
		<p className="mt-3 text-center text-muted-foreground text-xl">
			Ce véhicule n&apos;a pas encore été observé en circulation.
		</p>
	);
}
