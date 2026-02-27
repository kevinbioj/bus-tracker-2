import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Link } from "react-router-dom";

import { GetLineQuery } from "~/api/lines";
import { GetNetworkQuery } from "~/api/networks";
import type { VehicleTimelineDayActivity } from "~/api/vehicles";

type ActivityCardProps = { activity: VehicleTimelineDayActivity; day: string };

export function ActivityCard({ activity, day }: Readonly<ActivityCardProps>) {
	const { data: line } = useQuery(GetLineQuery(activity.lineId));
	const { data: network } = useQuery(GetNetworkQuery(line?.networkId, true));

	const ongoing = dayjs().diff(activity.updatedAt, "minutes") < 10;

	const cardContent = (
		<>
			{line?.cartridgeHref ? (
				<div className="h-full max-w-16">
					<img className="h-full" alt={line.number} src={line.cartridgeHref} />
				</div>
			) : (
				<p className="font-bold min-w-12 my-auto pt-px text-2xl text-center">{line?.number}</p>
			)}
			<div
				className="border-l mx-2"
				style={{
					borderColor: line?.textColor ? `#${line.textColor}` : undefined,
				}}
			/>
			<p className="flex-1 my-auto text-2xl">
				{ongoing ? (
					<>
						depuis{" "}
						<span className="font-bold tabular-nums">
							{dayjs(activity.startedAt).tz(network?.timezone).format("HH:mm")}
						</span>
					</>
				) : (
					<>
						<span className="font-bold tabular-nums">
							{dayjs(activity.startedAt).tz(network?.timezone).format("HH:mm")}
						</span>{" "}
						à{" "}
						<span className="font-bold tabular-nums">
							{dayjs(activity.updatedAt).tz(network?.timezone).format("HH:mm")}
						</span>
					</>
				)}
			</p>
		</>
	);

	const style = {
		backgroundColor: line?.color ? `#${line.color}` : undefined,
		color: line?.textColor ? `#${line.textColor}` : undefined,
	};

	if (line) {
		return (
			<Link
				className="border border-border flex h-14 px-2 py-1 rounded-md hover:brightness-90 transition-all"
				style={style}
				to={`/data/lines/${line.id}/vehicle-assignments?date=${day}`}
			>
				{cardContent}
			</Link>
		);
	}

	return (
		<article className="border border-border flex h-14 px-2 py-1 rounded-md" style={style}>
			{cardContent}
		</article>
	);
}
