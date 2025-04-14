import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";

import { GetLineQuery } from "~/api/lines";
import type { VehicleTimelineDayActivity } from "~/api/vehicles";

type ActivityCardProps = { activity: VehicleTimelineDayActivity };

export function ActivityCard({ activity }: Readonly<ActivityCardProps>) {
	const { data: line } = useQuery(GetLineQuery(activity.lineId));

	const ongoing = dayjs().diff(activity.updatedAt, "minutes") < 10;

	return (
		<article
			className="border border-border flex h-14 px-2 py-1 rounded-md"
			style={{
				backgroundColor: line?.color ? `#${line.color}` : undefined,
				color: line?.textColor ? `#${line.textColor}` : undefined,
			}}
		>
			{line?.cartridgeHref ? (
				<div className="h-full max-w-16">
					<img className="h-full" alt={line.number} src={line.cartridgeHref} />
				</div>
			) : (
				<p className="font-bold min-w-12 my-auto pt-[1px] text-2xl text-center">{line?.number}</p>
			)}
			<div
				className="border-l-[1px] mx-2"
				style={{
					borderColor: line?.textColor ? `#${line.textColor}` : undefined,
				}}
			/>
			<p className="flex-1 my-auto text-2xl">
				{ongoing ? (
					<>
						depuis <span className="font-bold tabular-nums">{dayjs(activity.startedAt).format("HH:mm")}</span>
					</>
				) : (
					<>
						<span className="font-bold tabular-nums">{dayjs(activity.startedAt).format("HH:mm")}</span> à{" "}
						<span className="font-bold tabular-nums">{dayjs(activity.updatedAt).format("HH:mm")}</span>
					</>
				)}
			</p>
		</article>
	);
}
