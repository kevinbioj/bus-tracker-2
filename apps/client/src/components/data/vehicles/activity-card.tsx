import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";

import { GetLineQuery } from "~/api/lines";
import type { VehicleTimelineDayActivity } from "~/api/vehicles";

export function ActivityCard({ activity }: { activity: VehicleTimelineDayActivity }) {
	const { data: line } = useQuery(GetLineQuery(activity.lineId));

	const ongoing = dayjs().diff(activity.updatedAt, "minutes") < 10;

	return (
		<article
			className="flex min-h-12 px-2 py-1 rounded-md"
			style={{
				backgroundColor: line?.color ? `#${line.color}` : undefined,
				color: line?.textColor ? `#${line.textColor}` : undefined,
			}}
		>
			{line?.cartridgeHref ? (
				<img className="h-12 mx-auto" alt={line.number} src={line.cartridgeHref} />
			) : (
				<p className="font-bold my-auto pt-[1px] text-2xl text-center w-12">{line?.number}</p>
			)}
			<div
				className="border-l-[1px] mx-2"
				style={{ borderColor: line?.textColor ? `#${line.textColor}` : undefined }}
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
