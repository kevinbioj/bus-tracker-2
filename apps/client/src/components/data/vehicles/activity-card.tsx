import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import { ArrowRight } from "lucide-react";

import { GetLineQuery } from "~/api/lines";
import { GetNetworkQuery } from "~/api/networks";
import type { VehicleTimelineDayActivity } from "~/api/vehicles";

type ActivityCardProps = { activity: VehicleTimelineDayActivity; day: string };

const TimeDisplay = ({ at, showDate }: { at: dayjs.Dayjs; showDate: boolean }) => (
	<div className="flex flex-col gap-0.5">
		{showDate && <span className="leading-none text-xs">{at.format("DD/MM")}</span>}
		<span className="font-bold leading-none tabular-nums">{at.format("HH:mm")}</span>
	</div>
);

export function ActivityCard({ activity, day }: Readonly<ActivityCardProps>) {
	const { data: line } = useQuery(GetLineQuery(activity.lineId));
	const { data: network } = useQuery(GetNetworkQuery(line?.networkId, true));

	const startedAt = dayjs(activity.startedAt).tz(network?.timezone);
	const updatedAt = dayjs(activity.updatedAt).tz(network?.timezone);
	const ongoing = dayjs().diff(updatedAt, "minutes") < 10;

	const didStartOnServiceDate = startedAt.isSame(day, "day");
	const didEndOnStartDate = updatedAt.isSame(startedAt, "day");

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
			<p className="flex-1 flex items-center gap-1 my-auto text-2xl">
				{ongoing ? (
					<>
						depuis <TimeDisplay at={startedAt} showDate={!didStartOnServiceDate} />
					</>
				) : (
					<>
						<TimeDisplay at={startedAt} showDate={!didStartOnServiceDate} />
						<ArrowRight className="inline" />
						<TimeDisplay at={updatedAt} showDate={!didStartOnServiceDate || !didEndOnStartDate} />
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
				to="/data/lines/$lineId/vehicle-assignments"
				params={{ lineId: String(line.id) }}
				search={{ date: day }}
			>
				{cardContent}
			</Link>
		);
	}

	return (
		<div className="border border-border flex h-14 px-2 py-1 rounded-md" style={style}>
			{cardContent}
		</div>
	);
}
