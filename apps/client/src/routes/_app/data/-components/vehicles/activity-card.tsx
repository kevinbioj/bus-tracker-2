import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import { ArrowRight } from "lucide-react";

import { GetLineQuery } from "~/api/lines";
import { GetNetworkQuery } from "~/api/networks";
import type { VehicleTimelineDayActivity } from "~/api/vehicles";
import * as m from "~/paraglide/messages";
import { dayjsTz } from "~/utils/timezone";

type ActivityCardProps = { activity: VehicleTimelineDayActivity; day: string };

function lineNumberTextSize(number: string) {
	if (number.length > 12) return "text-sm";
	if (number.length > 8) return "text-lg";
	return "text-2xl";
}

const TimeDisplay = ({ at, showDate }: { at: dayjs.Dayjs; showDate: boolean }) => (
	<div className="flex flex-col gap-0.5">
		{showDate && <span className="leading-none text-xs">{at.format("DD/MM")}</span>}
		<span className="font-bold leading-none tabular-nums">{at.format("HH:mm")}</span>
	</div>
);

export function ActivityCard({ activity, day }: Readonly<ActivityCardProps>) {
	const { data: line } = useQuery(GetLineQuery(activity.lineId));
	const { data: network } = useQuery(GetNetworkQuery(line?.networkId, true));

	const startedAt = dayjsTz(activity.startedAt, network?.timezone);
	const updatedAt = dayjsTz(activity.updatedAt, network?.timezone);
	const ongoing = dayjs().diff(updatedAt, "minutes") < 10;

	const didStartOnServiceDate = startedAt.isSame(day, "day");
	const didEndOnStartDate = updatedAt.isSame(startedAt, "day");

	const cardContent = (
		<>
			<div className="flex items-center justify-center h-full min-w-12 shrink- overflow-hidden">
				{line?.cartridgeHref ? (
					<img className="h-full max-w-16 object-contain" alt={line.number} src={line.cartridgeHref} />
				) : (
					<p
						className={`font-bold text-center leading-tight wrap-break-words line-clamp-2 ${lineNumberTextSize(line?.number ?? "")}`}
					>
						{line?.number}
					</p>
				)}
			</div>
			<div
				className="border-l mx-2"
				style={{
					borderColor: line?.textColor ? `#${line.textColor}` : undefined,
				}}
			/>
			<div className="flex-1 flex items-center gap-1 my-auto text-2xl">
				{ongoing ? (
					<>
						{m.vehicle_history_since()} <TimeDisplay at={startedAt} showDate={!didStartOnServiceDate} />
					</>
				) : (
					<>
						<TimeDisplay at={startedAt} showDate={!didStartOnServiceDate} />
						<ArrowRight className="inline" />
						<TimeDisplay at={updatedAt} showDate={!didStartOnServiceDate || !didEndOnStartDate} />
					</>
				)}
			</div>
		</>
	);

	const style = {
		backgroundColor: line?.color ? `#${line.color}` : undefined,
		color: line?.textColor ? `#${line.textColor}` : undefined,
	};

	if (line) {
		return (
			<Link
				className="border border-border flex h-14 px-2 py-1 rounded-md hover:brightness-90 transition-all active:not-aria-[haspopup]:translate-y-px"
				style={style}
				to="/data/lines/$lineId"
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
