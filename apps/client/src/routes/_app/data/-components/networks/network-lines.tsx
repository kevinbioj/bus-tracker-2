import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useMemo } from "react";

import { GetNetworkQuery } from "~/api/networks";
import * as m from "~/paraglide/messages";

type NetworkLinesProps = {
	networkId: number;
};

export function NetworkLines({ networkId }: Readonly<NetworkLinesProps>) {
	const { data: network } = useSuspenseQuery(GetNetworkQuery(networkId, true));

	const sortedLines = useMemo(
		() =>
			network.lines
				.filter((line) => line.archivedAt === null || dayjs().isBefore(line.archivedAt))
				.toSorted((a, b) => {
					const sortOrderDiff = (a.sortOrder ?? network.lines.length) - (b.sortOrder ?? network.lines.length);
					return sortOrderDiff || a.number.localeCompare(b.number, undefined, { numeric: true });
				}),
		[network],
	);

	return (
		<div className="overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 mt-2">
			{sortedLines.map((line) => (
				<Link
					key={line.id}
					to="/data/lines/$lineId/vehicle-assignments"
					params={{ lineId: String(line.id) }}
					className="h-14 border flex items-center gap-1 rounded-lg hover:brightness-90 active:not-aria-[haspopup]:translate-y-px transition-[filter,transform]"
					style={{
						backgroundColor: line.color ?? undefined,
						color: line.textColor ?? undefined,
					}}
				>
					<div className="p-1 h-full max-w-32 shrink-0 flex items-center justify-center">
						{line.cartridgeHref ? (
							<img className="object-contain h-full" src={line.cartridgeHref} alt={line.number} />
						) : (
							<span className="font-bold min-w-12 text-center text-lg">{line.girouetteNumber ?? line.number}</span>
						)}
					</div>
					<div className="flex-1 min-w-0">
						<p className="font-bold truncate">
							{line.girouetteNumber ? line.number : m.network_lines_label({ lineNumber: line.number })}
						</p>
						<div className="flex items-center gap-1.5 text-sm">
							{m.network_online_vehicle_count({
								count: line.onlineVehicleCount ?? 0,
								plural: (line.onlineVehicleCount ?? 0) > 1 ? "s" : "",
							})}
						</div>
					</div>
				</Link>
			))}
		</div>
	);
}
